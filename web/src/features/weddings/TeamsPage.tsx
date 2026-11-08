import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import {
  changePlanning,
  getPlanning,
  planningTime,
  workStatuses,
} from "../../lib/planning";
import type {
  Department,
  DepartmentInput,
  PlanningChange,
  WorkStatus,
} from "../../lib/planning";
import { getTeam } from "../../lib/team";
import type { Team } from "../../lib/team";
import { PlanningDialog } from "./PlanningDialog";

export function TeamsPage({
  userId,
  attentionOnly = false,
}: {
  userId: string;
  attentionOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [editor, setEditor] = useState<{
    item?: Department;
    version: number;
  } | null>(null);
  const [removing, setRemoving] = useState<Department | null>(null);
  const cache = useQueryClient();
  const editing = Boolean(selected || editor || removing);
  const query = useQuery({
    queryKey: ["planning", userId],
    queryFn: ({ signal }) => getPlanning(signal),
    refetchInterval: editing ? false : 30000,
    refetchOnWindowFocus: !editing,
    refetchIntervalInBackground: false,
  });
  const team = useQuery({
    queryKey: ["wedding-team", userId],
    queryFn: ({ signal }) => getTeam(signal),
    enabled: Boolean(query.data?.canManage),
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationFn: ({
      change,
      version,
    }: {
      change: PlanningChange;
      version: number;
    }) => changePlanning(change, version),
    onSuccess: (next, input) => {
      cache.setQueryData(["planning", userId], next);
      setSelected((current) =>
        current ? { ...current, version: next.version } : null,
      );
      if (["addDepartment", "editDepartment"].includes(input.change.action))
        setEditor(null);
      if (input.change.action === "removeDepartment") {
        setRemoving(null);
        setSelected(null);
      }
    },
  });
  const data = query.data;
  const department = data?.departments.find((item) => item.id === selected?.id);
  const departments =
    data?.departments.filter(
      (item) =>
        (!attentionOnly || item.attentionReasons.length > 0) &&
        (status === "All" || item.status === status) &&
        (item.name + " " + item.contactRole)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <div
      className={
        "planning-page" + (attentionOnly ? " planning-attention-page" : "")
      }
    >
      <div className="dash-page-heading">
        <div>
          <h1>{attentionOnly ? "Need Your Attention" : "Teams & Services"}</h1>
          <p>
            {attentionOnly
              ? "Review help requests, missed deadlines and departments without recent updates."
              : "Track work across family teams and vendors. Update progress or contact a department."}
          </p>
        </div>
        {data?.canManage && !attentionOnly && (
          <button
            className="ws-button ws-primary"
            disabled={query.isError}
            onClick={() => {
              mutation.reset();
              setEditor({ version: data.version });
            }}
          >
            <Icon name="plus" />
            Add department
          </button>
        )}
      </div>
      {query.isPending ? (
        <div className="plan-loading" role="status">
          Opening your shared plan…
        </div>
      ) : query.isError ? (
        <div className="plan-empty" role="alert">
          <p>{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Reload plan
          </button>
        </div>
      ) : (
        data && (
          <>
            <div className="plan-metrics">
              {[
                {
                  label: "Departments",
                  count: data.departments.length,
                  note: "Family teams & vendors",
                },
                {
                  label: "In progress",
                  count: data.departments.filter(
                    (item) => item.status === "In progress",
                  ).length,
                  note: "Moving things forward",
                },
                {
                  label: "Done",
                  count: data.departments.filter(
                    (item) => item.status === "Done",
                  ).length,
                  note: "One less thing to follow up",
                },
                {
                  label: "Need attention",
                  count: data.departments.filter(
                    (item) => item.attentionReasons.length,
                  ).length,
                  note: "Grouped by department",
                },
              ].map((item) => (
                <div className="plan-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
            <div className="plan-toolbar">
              <label className="plan-search">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search departments"
                  placeholder="Find a department or contact…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Filter by work status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option>All</option>
                {workStatuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {!attentionOnly && (
                <Link className="ws-text-link" to="/app/attention">
                  <Icon name="flag" />
                  View attention requests
                </Link>
              )}
            </div>
            {attentionOnly && (
              <div className="plan-settings">
                <div>
                  <strong>Flag departments without recent progress</strong>
                  <p>
                    Unfinished work appears here after {data.staleAfterDays}{" "}
                    days without a meaningful progress update. Contact edits and
                    page views don’t reset the timer.
                  </p>
                </div>
                {data.canManage && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const values = new FormData(event.currentTarget);
                      mutation.mutate({
                        change: {
                          action: "updateSettings",
                          staleAfterDays: Number(values.get("days")),
                        },
                        version: data.version,
                      });
                    }}
                  >
                    <label>
                      Days without progress
                      <input
                        key={data.staleAfterDays}
                        name="days"
                        type="number"
                        min={1}
                        max={30}
                        required
                        defaultValue={data.staleAfterDays}
                      />
                    </label>
                    <button className="ws-button" disabled={mutation.isPending}>
                      Save interval
                    </button>
                  </form>
                )}
              </div>
            )}
            {!departments.length ? (
              <div className="plan-empty">
                <span className="plan-empty-icon">
                  <Icon name={attentionOnly ? "check" : "people"} />
                </span>
                <h2>
                  {search || status !== "All"
                    ? "No departments match these filters."
                    : attentionOnly
                      ? "No departments need attention"
                      : "No departments yet"}
                </h2>
                <p>
                  {attentionOnly
                    ? "Open requests, missed deadlines and stale updates will appear here. Completed work is excluded from automatic checks."
                    : "Add your family teams or outside vendors. They don’t need an account for you to keep their details here."}
                </p>
                {data.canManage &&
                  !attentionOnly &&
                  !search &&
                  status === "All" && (
                    <button
                      className="ws-button ws-primary"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          change: { action: "applyTemplate" },
                          version: data.version,
                        })
                      }
                    >
                      Start with the wedding checklist <Icon name="plus" />
                    </button>
                  )}
              </div>
            ) : (
              <div className="plan-department-list">
                <div className="plan-register-heading" aria-hidden="true">
                  <span>Department & contact</span>
                  <span>Work status & checklist</span>
                  <span>Last progress & deadline</span>
                  <span />
                </div>
                {departments.map((item) => (
                  <article
                    key={item.id}
                    className={
                      "plan-department-card" +
                      (item.attentionReasons.length ? " has-attention" : "")
                    }
                  >
                    <div className="plan-department-identity">
                      <span className="plan-section-label">{item.kind}</span>
                      <h2>{item.name}</h2>
                      <div className="plan-contact">
                        <span>
                          {item.contactRole || "Contact can be added later"}
                        </span>
                        {item.phone && (
                          <a href={"tel:" + item.phone.replace(/[^+\d]/g, "")}>
                            <Icon name="phone" />
                            {item.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="plan-department-progress">
                      <span
                        className={
                          "plan-status " +
                          item.status.toLowerCase().replaceAll(" ", "-")
                        }
                      >
                        {item.status}
                      </span>
                      <div className="plan-checklist-count">
                        <span>Checklist</span>
                        <strong>
                          {item.completed} / {item.total}
                        </strong>
                      </div>
                      <progress
                        max={item.total || 1}
                        value={item.completed}
                        aria-label={item.name + " checklist completion"}
                      />
                    </div>
                    <dl className="plan-card-facts">
                      <div>
                        <dt>Last progress</dt>
                        <dd>{planningTime(item.lastProgressAt)}</dd>
                      </div>
                      <div>
                        <dt>Deadline</dt>
                        <dd>
                          {item.deadline
                            ? planningTime(item.deadline)
                            : "Not set"}
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="ws-button"
                      onClick={() => {
                        mutation.reset();
                        setSelected({ id: item.id, version: data.version });
                      }}
                    >
                      {item.canEdit ? "Open department" : "View progress"}
                    </button>
                    {item.attentionReasons.length > 0 && (
                      <div className="plan-attention-reasons">
                        <Icon name="flag" />
                        <ul>
                          {item.attentionReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            {data.canManage &&
              !attentionOnly &&
              data.departments.length > 0 && (
                <p className="plan-hint">
                  <button
                    className="ws-text-link"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        change: { action: "applyTemplate" },
                        version: data.version,
                      })
                    }
                  >
                    Add any missing starter departments
                  </button>{" "}
                  Existing teams are kept.
                </p>
              )}
            {mutation.isError && !selected && !editor && !removing && (
              <div className="ws-form-error" role="alert">
                <p>{apiMessage(mutation.error)}</p>
                <button
                  className="ws-text-link"
                  onClick={() => {
                    mutation.reset();
                    query.refetch();
                  }}
                >
                  Reload latest plan
                </button>
              </div>
            )}
            <p className="plan-footnote">
              Saved updates refresh across your team. For urgent changes, call
              your organizer.
            </p>
          </>
        )
      )}
      {department && selected && !query.isError && (
        <PlanningDialog
          title={department.name}
          wide
          onClose={() => {
            if (!mutation.isPending) {
              setSelected(null);
              mutation.reset();
            }
          }}
        >
          <DepartmentDetail
            item={department}
            saving={mutation.isPending}
            error={mutation.isError ? apiMessage(mutation.error) : ""}
            onChange={(change, onSuccess) =>
              mutation.mutate(
                { change, version: selected.version },
                { onSuccess },
              )
            }
            onEdit={() => {
              mutation.reset();
              setEditor({ item: department, version: selected.version });
            }}
            onRemove={() => {
              mutation.reset();
              setRemoving(department);
            }}
            onReload={async () => {
              setSelected(null);
              mutation.reset();
              await query.refetch();
            }}
          />
        </PlanningDialog>
      )}
      {editor && (
        <PlanningDialog
          title={editor.item ? "Edit department" : "Add department"}
          onClose={() => {
            if (!mutation.isPending) setEditor(null);
          }}
        >
          <DepartmentForm
            initial={editor.item}
            members={team.data?.members || []}
            membersLoading={team.isPending}
            membersError={team.isError ? apiMessage(team.error) : ""}
            onRetryMembers={() => team.refetch()}
            onReload={() => {
              setEditor(null);
              setSelected(null);
              mutation.reset();
              query.refetch();
            }}
            saving={mutation.isPending}
            error={mutation.isError ? apiMessage(mutation.error) : ""}
            onSave={(values) =>
              mutation.mutate({
                change: editor.item
                  ? { action: "editDepartment", id: editor.item.id, values }
                  : { action: "addDepartment", values },
                version: editor.version,
              })
            }
          />
        </PlanningDialog>
      )}
      {removing && (
        <PlanningDialog
          title="Remove this department?"
          onClose={() => {
            if (!mutation.isPending) setRemoving(null);
          }}
        >
          <p>
            {removing.name}, its checklist and recent updates will be removed.
            This won’t remove anyone from the wedding.
          </p>
          {mutation.isError && (
            <p className="ws-form-error" role="alert">
              {apiMessage(mutation.error)}
            </p>
          )}
          <div className="ws-form-actions">
            <button
              className="ws-button"
              disabled={mutation.isPending}
              onClick={() => setRemoving(null)}
            >
              Keep department
            </button>
            <button
              className="ws-button plan-destructive"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  change: { action: "removeDepartment", id: removing.id },
                  version: selected?.version ?? data!.version,
                })
              }
            >
              Remove department
            </button>
          </div>
        </PlanningDialog>
      )}
    </div>
  );
}

function DepartmentForm({
  initial,
  members,
  membersLoading,
  membersError,
  onRetryMembers,
  onReload,
  saving,
  error,
  onSave,
}: {
  initial?: Department;
  members: Team["members"];
  membersLoading: boolean;
  membersError: string;
  onRetryMembers: () => void;
  onReload: () => void;
  saving: boolean;
  error: string;
  onSave: (values: DepartmentInput) => void;
}) {
  const form = useForm<DepartmentInput>({
    defaultValues: {
      name: initial?.name || "",
      kind: initial?.kind || "Family team",
      contactRole: initial?.contactRole || "",
      phone: initial?.phone || "",
      notes: initial?.notes || "",
      deadline: initial?.deadline || "",
      memberIds: initial?.memberIds || [],
    },
  });
  return (
    <form className="plan-form" onSubmit={form.handleSubmit(onSave)}>
      <fieldset disabled={saving}>
        <label>
          Department / service name
          <input
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Catering or Family decoration team"
            {...form.register("name")}
          />
        </label>
        <label>
          Managed by
          <select {...form.register("kind")}>
            <option>Family team</option>
            <option>Outside vendor</option>
          </select>
        </label>
        <div className="plan-field-grid">
          <label>
            Contact role / service name
            <input maxLength={100} {...form.register("contactRole")} />
          </label>
          <label>
            Phone (optional)
            <input type="tel" maxLength={20} {...form.register("phone")} />
          </label>
        </div>
        <label>
          Next deadline (IST, optional)
          <input type="datetime-local" {...form.register("deadline")} />
        </label>
        <label>
          Internal notes
          <textarea maxLength={2000} rows={3} {...form.register("notes")} />
        </label>
        <div className="plan-member-picker">
          <strong>Who can update this department?</strong>
          <p>
            Organizers already have access. Assigned Managers and Workers can
            update this department’s work and see its notes.
          </p>
          {membersLoading ? (
            <p role="status">Loading wedding members…</p>
          ) : membersError ? (
            <div role="alert">
              <p>{membersError}</p>
              <button
                className="ws-button"
                type="button"
                onClick={onRetryMembers}
              >
                Reload members
              </button>
            </div>
          ) : members.filter(
              (member) => member.role === "Manager" || member.role === "Worker",
            ).length ? (
            members
              .filter(
                (member) =>
                  member.role === "Manager" || member.role === "Worker",
              )
              .map((member) => (
                <label className="plan-checkbox" key={member.id}>
                  <input
                    type="checkbox"
                    value={member.id}
                    {...form.register("memberIds")}
                  />
                  <span>
                    {member.name}
                    <small>{member.role}</small>
                  </span>
                </label>
              ))
          ) : (
            <p>
              Invite helpers through People & Access, then assign them here.
              Outside vendors can stay account-free.
            </p>
          )}
        </div>
        {error && (
          <div role="alert" className="ws-form-error">
            <p>{error}</p>
            <button type="button" className="ws-text-link" onClick={onReload}>
              Discard draft & reload latest plan
            </button>
          </div>
        )}
        <div className="ws-form-actions">
          <button
            className="ws-button ws-primary"
            disabled={saving || membersLoading || Boolean(membersError)}
          >
            {saving ? "Saving…" : "Save department"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function DepartmentDetail({
  item,
  saving,
  error,
  onChange,
  onEdit,
  onRemove,
  onReload,
}: {
  item: Department;
  saving: boolean;
  error: string;
  onChange: (change: PlanningChange, onSuccess?: () => void) => void;
  onEdit: () => void;
  onRemove: () => void;
  onReload: () => void;
}) {
  const progress = useForm<{
    status: WorkStatus;
    note: string;
    onBehalf: boolean;
  }>({ defaultValues: { status: item.status, note: "", onBehalf: false } });
  const checklist = useForm<{ title: string }>();
  const flag = useForm<{ reason: string }>();
  return (
    <div className="plan-detail">
      <div className="plan-detail-summary">
        <span
          className={
            "plan-status " + item.status.toLowerCase().replaceAll(" ", "-")
          }
        >
          {item.status}
        </span>
        <span>{item.kind}</span>
        {item.phone && (
          <a
            className="ws-button"
            href={"tel:" + item.phone.replace(/[^+\d]/g, "")}
          >
            <Icon name="phone" />
            {item.contactRole || "Call contact"}
          </a>
        )}
        {item.canManage && (
          <button className="ws-text-link" onClick={onEdit}>
            Edit details & access
          </button>
        )}
      </div>
      {error && (
        <div className="ws-form-error" role="alert">
          <p>{error}</p>
          <button className="ws-text-link" onClick={onReload}>
            Close draft & reload latest plan
          </button>
        </div>
      )}
      {item.attentionReasons.length > 0 && (
        <div className="plan-attention-reasons">
          <Icon name="flag" />
          <ul>
            {item.attentionReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {item.hasManualFlag && item.canManage && (
            <button
              className="ws-button"
              disabled={saving}
              onClick={() =>
                onChange({ action: "resolveAttention", id: item.id })
              }
            >
              Resolve flag
            </button>
          )}
        </div>
      )}
      <dl className="plan-card-facts">
        <div>
          <dt>Last meaningful progress</dt>
          <dd>{planningTime(item.lastProgressAt)}</dd>
        </div>
        <div>
          <dt>Next deadline</dt>
          <dd>{item.deadline ? planningTime(item.deadline) : "Not set"}</dd>
        </div>
      </dl>
      {!item.canEdit ? (
        <p className="plan-hint">
          You can follow this team’s progress. Detailed notes and checklist
          editing are available to its assigned members and organizers.
        </p>
      ) : (
        <>
          {item.notes && (
            <section className="plan-detail-section">
              <h3>Internal notes</h3>
              <p className="plan-note">{item.notes}</p>
            </section>
          )}
          <section className="plan-detail-section">
            <h3>Update the team</h3>
            <form
              className="plan-form"
              onSubmit={progress.handleSubmit((values) =>
                onChange({ action: "updateWork", id: item.id, ...values }, () =>
                  progress.reset({ ...values, note: "", onBehalf: false }),
                ),
              )}
            >
              <fieldset disabled={saving}>
                <div className="plan-field-grid">
                  <label>
                    Work status
                    <select {...progress.register("status")}>
                      {workStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Progress note
                    <textarea
                      maxLength={2000}
                      placeholder="What has moved forward?"
                      {...progress.register("note")}
                    />
                  </label>
                </div>
                {item.canManage && (
                  <label className="plan-checkbox">
                    <input type="checkbox" {...progress.register("onBehalf")} />
                    <span>Recording this on behalf of the vendor</span>
                  </label>
                )}
                <button className="ws-button ws-primary" disabled={saving}>
                  Save progress update
                </button>
              </fieldset>
            </form>
          </section>
          <section className="plan-detail-section">
            <div className="plan-section-title">
              <h3>Shared checklist</h3>
              <span>
                {item.completed} / {item.total} done
              </span>
            </div>
            {!item.checklist?.length && (
              <p className="plan-muted">
                Add the things this team needs to get done.
              </p>
            )}
            <ul className="plan-checklist">
              {item.checklist?.map((task) => (
                <li key={task.id}>
                  <span>{task.title}</span>
                  <select
                    aria-label={"Status for " + task.title}
                    value={task.status}
                    disabled={saving}
                    onChange={(event) =>
                      onChange({
                        action: "updateChecklistItem",
                        id: item.id,
                        itemId: task.id,
                        status: event.target.value as WorkStatus,
                      })
                    }
                  >
                    {workStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  {item.canManage && (
                    <button
                      className="ws-text-link plan-danger"
                      disabled={saving}
                      onClick={() =>
                        onChange({
                          action: "removeChecklistItem",
                          id: item.id,
                          itemId: task.id,
                        })
                      }
                      aria-label={"Remove " + task.title}
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="plan-add-item"
              onSubmit={checklist.handleSubmit((values) =>
                onChange(
                  {
                    action: "addChecklistItem",
                    id: item.id,
                    title: values.title,
                  },
                  () => checklist.reset({ title: "" }),
                ),
              )}
            >
              <input
                required
                minLength={2}
                maxLength={160}
                placeholder="Add a checklist item"
                aria-label="New checklist item"
                disabled={saving}
                {...checklist.register("title")}
              />
              <button className="ws-button" disabled={saving}>
                <Icon name="plus" />
                Add
              </button>
            </form>
          </section>
          <section className="plan-detail-section">
            <h3>Need an organizer’s help?</h3>
            <form
              className="plan-add-item"
              onSubmit={flag.handleSubmit((values) =>
                onChange(
                  {
                    action: "raiseAttention",
                    id: item.id,
                    reason: values.reason,
                  },
                  () => flag.reset({ reason: "" }),
                ),
              )}
            >
              <input
                required
                minLength={3}
                maxLength={500}
                placeholder="Briefly explain what you need"
                aria-label="Attention request reason"
                disabled={saving}
                {...flag.register("reason")}
              />
              <button className="ws-button" disabled={saving}>
                <Icon name="flag" />
                Raise flag
              </button>
            </form>
            <p className="plan-muted">
              This keeps your current work status. Only organizers can resolve
              the request.
            </p>
          </section>
          <section className="plan-detail-section">
            <h3>Recent updates</h3>
            <ol className="plan-history">
              {item.updates?.map((update) => (
                <li key={update.id}>
                  <strong>
                    {update.actor}
                    {update.onBehalf ? " (on behalf of vendor)" : ""}
                  </strong>
                  <p>{update.message}</p>
                  <time dateTime={update.at}>{planningTime(update.at)}</time>
                </li>
              ))}
            </ol>
            <small className="plan-muted">
              The latest 30 updates are kept for each department.
            </small>
          </section>
        </>
      )}
      {item.canManage && (
        <div className="plan-detail-footer">
          <button
            className="ws-text-link plan-danger"
            disabled={saving}
            onClick={onRemove}
          >
            Remove department
          </button>
        </div>
      )}
    </div>
  );
}
