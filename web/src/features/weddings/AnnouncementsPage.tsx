import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import { getPlanning } from "../../lib/planning";
import { changeAnnouncement, getAnnouncements } from "../../lib/site";
import type {
  Announcement,
  AnnouncementChange,
  AnnouncementInput,
} from "../../lib/site";
import { PlanningDialog } from "./PlanningDialog";

export function AnnouncementsPage({ userId }: { userId: string }) {
  const [editor, setEditor] = useState<{
    item?: Announcement;
    version: number;
  } | null>(null);
  const [removing, setRemoving] = useState<{
    item: Announcement;
    version: number;
  } | null>(null);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["announcements", userId],
    queryFn: ({ signal }) => getAnnouncements(signal),
    refetchInterval: editor || removing ? false : 30000,
    refetchOnWindowFocus: !editor && !removing,
    refetchIntervalInBackground: false,
  });
  const planning = useQuery({
    queryKey: ["planning", userId],
    queryFn: ({ signal }) => getPlanning(signal),
    staleTime: 30000,
  });
  const form = useForm<AnnouncementInput>({
    defaultValues: {
      title: "",
      text: "",
      scope: "public",
      functionIds: [],
      published: false,
    },
  });
  const scope = form.watch("scope");
  const selectedIds = form.watch("functionIds");
  const published = form.watch("published");
  const mutation = useMutation({
    mutationFn: ({
      change,
      version,
    }: {
      change: AnnouncementChange;
      version: number;
    }) => changeAnnouncement(change, version),
    onSuccess: async (next) => {
      cache.setQueryData(["announcements", userId], next);
      setEditor(null);
      setRemoving(null);
      await cache.invalidateQueries({ queryKey: ["public-announcements"] });
    },
  });
  const conflict =
    axios.isAxiosError(mutation.error) &&
    mutation.error.response?.status === 409;
  function openEditor(item?: Announcement) {
    if (!query.data) return;
    mutation.reset();
    form.reset(
      item
        ? {
            title: item.title,
            text: item.text,
            scope: item.scope,
            functionIds: [...item.functionIds],
            published: item.published,
          }
        : {
            title: "",
            text: "",
            scope: "public",
            functionIds: [],
            published: false,
          },
    );
    setEditor({ item, version: query.data.version });
  }
  async function reloadVersion() {
    const latest = await query.refetch();
    if (!latest.data || latest.isError) return;
    setEditor((current) =>
      current ? { ...current, version: latest.data.version } : null,
    );
    setRemoving((current) =>
      current ? { ...current, version: latest.data.version } : null,
    );
    mutation.reset();
  }
  return (
    <div className="announcements-page">
      <div className="dash-page-heading">
        <div>
          <h1>Guest updates</h1>
          <p>
            Keep guests informed when timings change or the family has something
            to share.
          </p>
        </div>
        <button
          type="button"
          className="ws-button ws-primary"
          disabled={!query.data || query.isError}
          onClick={() => openEditor()}
        >
          <Icon name="plus" />
          Write update
        </button>
      </div>
      <div className="media-notice">
        <Icon name="globe" />
        <p>
          Published updates appear on the wedding website. Function updates are
          only shown to families invited to those functions.
        </p>
      </div>
      {query.isError && (
        <div className="media-notice is-error" role="alert">
          <p>{apiMessage(query.error)}</p>
          <button
            type="button"
            className="ws-button"
            onClick={() => void query.refetch()}
          >
            Reload updates
          </button>
        </div>
      )}
      {query.isPending ? (
        <div className="media-empty" role="status">
          <Icon name="message" />
          <p>Opening your guest updates…</p>
        </div>
      ) : query.data && !query.data.announcements.length ? (
        <div className="media-empty">
          <Icon name="message" />
          <h2>Keep everyone in the loop.</h2>
          <p>
            Share a timing change, a venue note or a message from the family.
            Your first update starts as a draft.
          </p>
          <button
            type="button"
            className="ws-button"
            onClick={() => openEditor()}
          >
            Write your first update
          </button>
        </div>
      ) : null}
      {query.data && query.data.announcements.length > 0 && (
        <div className="announcement-list">
          {query.data.announcements.map((item) => (
            <article key={item.id} className="announcement-row">
              <div className="announcement-copy">
                <div className="announcement-meta">
                  <span
                    className={
                      "announcement-state" +
                      (item.published ? " is-published" : "")
                    }
                  >
                    {item.published ? "Published" : "Draft"}
                  </span>
                  <time dateTime={item.updatedAt}>
                    Updated{" "}
                    {new Date(item.updatedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </time>
                </div>
                <h2>{item.title}</h2>
                <p className="announcement-body">{item.text}</p>
                <p className="announcement-audience">
                  {item.scope === "public"
                    ? "For everyone on the wedding website"
                    : "For families invited to: " +
                      item.functionIds
                        .map(
                          (id) =>
                            planning.data?.functions.find(
                              (item) => item.id === id,
                            )?.name || "Selected function",
                        )
                        .join(", ")}
                  {!item.published && ". Not visible to guests."}
                </p>
              </div>
              <div className="announcement-actions">
                <button
                  type="button"
                  className="ws-button"
                  onClick={() => openEditor(item)}
                >
                  Edit update
                </button>
                <button
                  type="button"
                  className="ws-button"
                  onClick={() => {
                    mutation.reset();
                    setRemoving({ item, version: query.data!.version });
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <PlanningDialog
          title={editor.item ? "Edit guest update" : "Write guest update"}
          onClose={() => {
            if (!mutation.isPending) setEditor(null);
          }}
        >
          <form
            className="media-form announcement-form"
            onSubmit={form.handleSubmit((values) => {
              const functionIds = values.functionIds.filter((id) =>
                planning.data?.functions.some((item) => item.id === id),
              );
              if (values.scope === "functions" && !functionIds.length) {
                form.setError("functionIds", {
                  type: "validate",
                  message: "Choose at least one function.",
                });
                return;
              }
              const input = {
                ...values,
                functionIds: values.scope === "public" ? [] : functionIds,
              };
              mutation.mutate({
                change: editor.item
                  ? { action: "edit", id: editor.item.id, values: input }
                  : { action: "add", values: input },
                version: editor.version,
              });
            })}
          >
            <label>
              Update title
              <input
                type="text"
                autoComplete="off"
                minLength={2}
                maxLength={120}
                {...form.register("title", {
                  required: "Add a title.",
                  minLength: {
                    value: 2,
                    message: "Use at least 2 characters.",
                  },
                  maxLength: 120,
                })}
              />
            </label>
            {form.formState.errors.title && (
              <p className="ws-error" role="alert">
                {form.formState.errors.title.message}
              </p>
            )}
            <label>
              Message
              <textarea
                rows={5}
                minLength={3}
                maxLength={1000}
                {...form.register("text", {
                  required: "Write your guest update.",
                  minLength: {
                    value: 3,
                    message: "Use at least 3 characters.",
                  },
                  maxLength: 1000,
                })}
              />
            </label>
            {form.formState.errors.text && (
              <p className="ws-error" role="alert">
                {form.formState.errors.text.message}
              </p>
            )}
            <fieldset className="announcement-audience-fields">
              <legend>Who can see this update?</legend>
              <label>
                <input
                  type="radio"
                  value="public"
                  {...form.register("scope")}
                />
                <span>Everyone on the wedding website</span>
              </label>
              <label>
                <input
                  type="radio"
                  value="functions"
                  {...form.register("scope")}
                />
                <span>Families invited to selected functions</span>
              </label>
            </fieldset>
            {scope === "functions" && (
              <fieldset className="announcement-function-fields">
                <legend>Select functions</legend>
                {planning.isPending ? (
                  <p role="status">Opening your function list…</p>
                ) : planning.isError ? (
                  <div>
                    <p className="ws-error" role="alert">
                      {apiMessage(planning.error)}
                    </p>
                    <button
                      type="button"
                      className="ws-button"
                      onClick={() => void planning.refetch()}
                    >
                      Reload functions
                    </button>
                  </div>
                ) : !planning.data.functions.length ? (
                  <p>
                    No functions have been added yet. Add a function before
                    publishing a function-specific update.
                  </p>
                ) : (
                  planning.data.functions.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(event) => {
                          form.setValue(
                            "functionIds",
                            event.target.checked
                              ? [...selectedIds, item.id]
                              : selectedIds.filter((id) => id !== item.id),
                            { shouldDirty: true },
                          );
                          form.clearErrors("functionIds");
                        }}
                      />
                      <span>{item.name}</span>
                    </label>
                  ))
                )}
                {form.formState.errors.functionIds && (
                  <p className="ws-error" role="alert">
                    {form.formState.errors.functionIds.message}
                  </p>
                )}
              </fieldset>
            )}
            <label className="announcement-publish">
              <input type="checkbox" {...form.register("published")} />
              <span>Publish this update now</span>
            </label>
            <p className="media-muted">
              {published
                ? "This update will be visible to the selected audience."
                : "Drafts are only visible to organizers."}
            </p>
            {mutation.isError && (
              <div className="announcement-error" role="alert">
                <p>{apiMessage(mutation.error)}</p>
                {conflict && (
                  <>
                    <p>
                      Your draft has been kept. Reload the current list, review
                      your draft and save again.
                    </p>
                    <button
                      type="button"
                      className="ws-button"
                      disabled={query.isFetching}
                      onClick={() => void reloadVersion()}
                    >
                      Reload latest updates
                    </button>
                  </>
                )}
              </div>
            )}
            {query.isError && (
              <p className="ws-error" role="alert">
                The latest updates could not be loaded. Your draft is still
                here.
              </p>
            )}
            <div className="announcement-actions">
              <button
                type="submit"
                className="ws-button ws-primary"
                disabled={
                  mutation.isPending ||
                  (scope === "functions" &&
                    (!planning.data?.functions.length || planning.isError))
                }
                aria-busy={mutation.isPending}
              >
                {mutation.isPending
                  ? "Saving update…"
                  : published
                    ? "Publish update"
                    : "Save draft"}
              </button>
              <button
                type="button"
                className="ws-button"
                disabled={mutation.isPending}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </PlanningDialog>
      )}
      {removing && (
        <PlanningDialog
          title="Remove guest update?"
          onClose={() => {
            if (!mutation.isPending) setRemoving(null);
          }}
        >
          <div className="media-form">
            <p>
              “{removing.item.title}” will be removed from your updates and will
              no longer appear on the guest website.
            </p>
            {mutation.isError && (
              <div className="announcement-error" role="alert">
                <p>{apiMessage(mutation.error)}</p>
                {conflict && (
                  <button
                    type="button"
                    className="ws-button"
                    disabled={query.isFetching}
                    onClick={() => void reloadVersion()}
                  >
                    Reload latest updates
                  </button>
                )}
              </div>
            )}
            <div className="announcement-actions">
              <button
                type="button"
                className="ws-button"
                disabled={mutation.isPending}
                onClick={() => setRemoving(null)}
              >
                Keep update
              </button>
              <button
                type="button"
                className="ws-button ws-primary"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    change: { action: "remove", id: removing.item.id },
                    version: removing.version,
                  })
                }
              >
                {mutation.isPending ? "Removing…" : "Remove update"}
              </button>
            </div>
          </div>
        </PlanningDialog>
      )}
    </div>
  );
}
