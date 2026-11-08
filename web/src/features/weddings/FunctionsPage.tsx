import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import { changePlanning, getPlanning, planningTime } from "../../lib/planning";
import type {
  FunctionInput,
  PlanningChange,
  WeddingFunction,
} from "../../lib/planning";
import {
  canOrganize,
  directions,
  weddingDate,
  weddingTime,
} from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import { PlanningDialog } from "./PlanningDialog";

export function FunctionsPage({
  data,
  userId,
}: {
  data: Workspace;
  userId: string;
}) {
  const wedding = data.wedding!;
  const organizer = canOrganize(data.role);
  const [editor, setEditor] = useState<{
    item?: WeddingFunction;
    version: number;
  } | null>(null);
  const [removing, setRemoving] = useState<
    (WeddingFunction & { version: number }) | null
  >(null);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["planning", userId],
    queryFn: ({ signal }) => getPlanning(signal),
    refetchInterval: editor || removing ? false : 30000,
    refetchOnWindowFocus: !editor && !removing,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: ({
      change,
      version,
    }: {
      change: PlanningChange;
      version: number;
    }) => changePlanning(change, version),
    onSuccess: async (next) => {
      cache.setQueryData(["planning", userId], next);
      await cache.invalidateQueries({
        queryKey: ["public-functions", wedding.publicId],
      });
      setEditor(null);
      setRemoving(null);
    },
  });
  return (
    <div className="planning-page">
      <div className="dash-page-heading">
        <div>
          <h1>Functions & ceremonies</h1>
          <p>
            Manage ceremony dates, timings, venues and guest visibility.
          </p>
        </div>
        {organizer && (
          <button
            className="ws-button ws-primary"
            disabled={!query.data || query.isError}
            onClick={() => {
              mutation.reset();
              setEditor({ version: query.data!.version });
            }}
          >
            <Icon name="plus" />
            Add function
          </button>
        )}
      </div>
      <section className="plan-ceremony-card">
        <div className="plan-date-tile">
          <span>
            {new Date(wedding.date + "T12:00:00+05:30").toLocaleDateString(
              "en-IN",
              { month: "short", timeZone: "Asia/Kolkata" },
            )}
          </span>
          <strong>{wedding.date.slice(8)}</strong>
          <span>{wedding.date.slice(0, 4)}</span>
        </div>
        <div className="plan-ceremony-info">
          <div className="plan-ceremony-labels">
            <span className="plan-section-label">Main wedding</span>
            <span className="plan-visibility is-public">
              Always on your guest website
            </span>
          </div>
          <h2>{weddingDate(wedding.date)}</h2>
          <strong>
            {wedding.brideName} & {wedding.groomName}
          </strong>
          <p>
            <Icon name="clock" />
            {weddingTime(wedding.startTime)}
            {wedding.endTime ? " – " + weddingTime(wedding.endTime) : ""} IST
          </p>
          <p>
            <Icon name="pin" />
            {wedding.venue}, {wedding.city}
          </p>
        </div>
        <div className="plan-card-actions">
          <a
            href={directions(wedding)}
            target="_blank"
            rel="noreferrer"
            className="ws-button"
          >
            <Icon name="pin" />
            Directions
          </a>
          {organizer && (
            <Link className="ws-text-link" to="/app/wedding/edit">
              Edit main wedding
            </Link>
          )}
        </div>
      </section>
      {!wedding.endTime && (
        <p className="plan-hint">
          Add the main wedding’s end time in Wedding settings to check its full
          duration against other functions.
        </p>
      )}
      <div className="plan-section-title">
        <h2>Function schedule</h2>
        <span>
          {query.data?.functions.length || 0} additional functions. All times in
          IST.
        </span>
      </div>
      {query.isPending ? (
        <div className="plan-loading" role="status">
          Loading functions…
        </div>
      ) : query.isError ? (
        <div className="plan-empty" role="alert">
          <p>{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Reload schedule
          </button>
        </div>
      ) : !query.data.functions.length ? (
        <div className="plan-empty">
          <span className="plan-empty-icon">
            <Icon name="calendar" />
          </span>
          <h2>No additional functions yet</h2>
          <p>
            Add your Haldi, Mehendi, Sangeet or reception when the family is
            ready. Your main wedding is already here.
          </p>
          {organizer && (
            <button
              className="ws-button ws-primary"
              onClick={() => {
                mutation.reset();
                setEditor({ version: query.data.version });
              }}
            >
              Plan your first function <Icon name="plus" />
            </button>
          )}
        </div>
      ) : (
        <div className="plan-timeline">
          {query.data.functions.map((item) => (
            <article className="plan-function-card" key={item.id}>
              <div className="plan-function-date">
                <time dateTime={item.startsAt}>
                  <strong>{item.startsAt.slice(8, 10)}</strong>
                  {new Date(item.startsAt + ":00+05:30").toLocaleDateString(
                    "en-IN",
                    {
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    },
                  )}
                </time>
              </div>
              <div className="plan-function-body">
                <div className="plan-function-top">
                  <h2>{item.name}</h2>
                  <span
                    className={
                      "plan-visibility " +
                      (item.guestVisible ? "is-public" : "")
                    }
                  >
                    {item.guestVisible ? "On guest website" : "Team only"}
                  </span>
                </div>
                <strong className="plan-function-time">
                  {planningTime(item.startsAt)}
                </strong>
                <p className="plan-muted">Until {planningTime(item.endsAt)}</p>
                <div className="plan-function-venue">
                  <Icon name="pin" />
                  <div>
                    <strong>{item.venue}</strong>
                    <p>
                      {item.address}, {item.city}
                    </p>
                  </div>
                </div>
                <a
                  className="ws-text-link"
                  target="_blank"
                  rel="noreferrer"
                  href={
                    "https://www.google.com/maps/dir/?api=1&destination=" +
                    encodeURIComponent(item.address + ", " + item.city)
                  }
                >
                  Get directions
                </a>
              </div>
              {organizer && (
                <div className="plan-inline-actions">
                  <button
                    className="ws-button"
                    onClick={() => {
                      mutation.reset();
                      setEditor({ item, version: query.data.version });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="ws-text-link plan-danger"
                    onClick={() => {
                      mutation.reset();
                      setRemoving({ ...item, version: query.data.version });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {editor && (
        <PlanningDialog
          title={editor.item ? "Edit function" : "A new wedding moment"}
          onClose={() => {
            if (!mutation.isPending) setEditor(null);
          }}
        >
          <FunctionForm
            initial={editor.item}
            wedding={wedding}
            saving={mutation.isPending}
            error={mutation.isError ? apiMessage(mutation.error) : ""}
            onSave={(values) =>
              mutation.mutate({
                version: editor.version,
                change: editor.item
                  ? { action: "editFunction", id: editor.item.id, values }
                  : { action: "addFunction", values },
              })
            }
            onReload={() => {
              setEditor(null);
              query.refetch();
            }}
          />
        </PlanningDialog>
      )}
      {removing && (
        <PlanningDialog
          title="Remove this function?"
          onClose={() => {
            if (!mutation.isPending) setRemoving(null);
          }}
        >
          <p>
            {removing.name} will be removed from the plan and the guest website.
          </p>
          {mutation.isError && (
            <p role="alert" className="ws-form-error">
              {apiMessage(mutation.error)}
            </p>
          )}
          <div className="ws-form-actions">
            <button
              className="ws-button"
              onClick={() => setRemoving(null)}
              disabled={mutation.isPending}
            >
              Keep function
            </button>
            <button
              className="ws-button plan-destructive"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  change: { action: "removeFunction", id: removing.id },
                  version: removing.version,
                })
              }
            >
              Remove function
            </button>
          </div>
        </PlanningDialog>
      )}
    </div>
  );
}

function FunctionForm({
  initial,
  wedding,
  saving,
  error,
  onSave,
  onReload,
}: {
  initial?: WeddingFunction;
  wedding: Workspace["wedding"];
  saving: boolean;
  error: string;
  onSave: (values: FunctionInput) => void;
  onReload: () => void;
}) {
  const { register, handleSubmit } = useForm<FunctionInput>({
    defaultValues: initial || {
      name: "",
      startsAt: "",
      endsAt: "",
      venue: wedding!.venue,
      address: wedding!.address,
      city: wedding!.city,
      guestVisible: false,
    },
  });
  return (
    <form className="plan-form" onSubmit={handleSubmit(onSave)}>
      <fieldset disabled={saving}>
        <p className="plan-muted">
          Enter all times in Indian Standard Time (IST).
        </p>
        <label>
          Function name
          <input
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Mehendi or Sangeet"
            {...register("name")}
          />
        </label>
        <div className="plan-field-grid">
          <label>
            Starts at (IST)
            <input required type="datetime-local" {...register("startsAt")} />
          </label>
          <label>
            Ends at (IST)
            <input required type="datetime-local" {...register("endsAt")} />
          </label>
        </div>
        <label>
          Venue
          <input
            required
            minLength={2}
            maxLength={160}
            {...register("venue")}
          />
        </label>
        <label>
          Full address
          <textarea
            required
            minLength={5}
            maxLength={500}
            {...register("address")}
          />
        </label>
        <label>
          City & state
          <input required minLength={2} maxLength={100} {...register("city")} />
        </label>
        <label className="plan-checkbox">
          <input type="checkbox" {...register("guestVisible")} />
          <span>
            Show on the public guest website
            <small>
              Anyone with your wedding website link can see this function. Leave
              this off for family planning.
            </small>
          </span>
        </label>
        {error && (
          <div className="ws-form-error" role="alert">
            <p>{error}</p>
            <button type="button" className="ws-text-link" onClick={onReload}>
              Discard draft & reload latest plan
            </button>
          </div>
        )}
        <div className="ws-form-actions">
          <button className="ws-button ws-primary" disabled={saving}>
            {saving ? "Saving…" : "Save function"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
