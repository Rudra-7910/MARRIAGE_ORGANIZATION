import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Icon } from "../../components/ui/Icon";
import {
  apiMessage,
  directions,
  needsSetup,
  signedOut,
  weddingDate,
} from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import {
  getGuests,
  getInvitation,
  invitationLabels,
  previewInvitation,
  retryInvitation,
  saveGuest,
  sendInvitation,
} from "../../lib/invitations";
import type { GuestRecord, InvitationDraft } from "../../lib/invitations";

const guestSchema = z.object({
  name: z.string().trim().min(2, "Enter the guest or family name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  side: z.enum(["Bride", "Groom", "Both"]),
});
const emailSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Add an email subject.")
    .max(240)
    .regex(/^[^\r\n]+$/, "Use one line for the subject."),
  message: z.string().trim().min(1, "Add a personal note.").max(3000),
});

export function GuestsPage({ userId }: { userId: string }) {
  const [side, setSide] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<GuestRecord | "new" | null>(null);
  const query = useQuery({
    queryKey: ["guests", userId, { side, search, page }],
    queryFn: () => getGuests({ side, search, page }),
    refetchInterval: 10000,
  });
  if (signedOut(query.error)) return <Navigate to="/login" replace />;
  if (needsSetup(query.error)) return <Navigate to="/app/setup" replace />;
  return (
    <div className="invite-page">
      <div className="dash-page-heading">
        <div>
          <span className="dash-kicker">A LITTLE JOY, IN THEIR INBOX</span>
          <h1>Guests & invitations</h1>
          <p>Your favourite people. A personal invitation for every family.</p>
        </div>
        <button className="ws-button ws-primary" onClick={() => setForm("new")}>
          <Icon name="plus" />
          Add guest / family
        </button>
      </div>
      {query.data && (
        <div className="invite-summary" aria-label="Invitation summary">
          <div>
            <span>Guest / family entries</span>
            <strong>{query.data.summary.total}</strong>
          </div>
          <div>
            <span>Not sent</span>
            <strong>{query.data.summary.notSent}</strong>
          </div>
          <div>
            <span>Submitted to provider</span>
            <strong>{query.data.summary.submitted}</strong>
          </div>
          <div>
            <span>Need attention</span>
            <strong>{query.data.summary.attention}</strong>
          </div>
        </div>
      )}
      {query.data && !query.data.emailConfigured && (
        <p className="invite-notice" role="status">
          <Icon name="mail" />
          <span>
            <strong>Email sender isn’t configured yet.</strong> You can save
            guests and preview invitations. Add RESEND_API_KEY and RESEND_FROM
            in server/.env, then restart the server to send.
          </span>
        </p>
      )}
      {form && (
        <GuestForm
          key={form === "new" ? "new" : form.id}
          guest={form === "new" ? undefined : form}
          userId={userId}
          onClose={() => setForm(null)}
        />
      )}
      <section className="dash-card invite-directory">
        <div className="invite-directory-tools">
          <div className="dash-tabs" aria-label="Filter guests by side">
            {["All", "Bride", "Groom", "Both"].map((value) => (
              <button
                key={value}
                className={side === value ? "is-active" : ""}
                aria-pressed={side === value}
                onClick={() => {
                  setSide(value);
                  setPage(1);
                }}
              >
                {value === "All"
                  ? "All families"
                  : value === "Both"
                    ? "Both sides"
                    : value + "’s side"}
              </button>
            ))}
          </div>
          <label className="invite-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Search guests"
              placeholder="Search name or email"
              maxLength={100}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {query.isPending ? (
          <p className="invite-empty" role="status">
            Loading your guest list…
          </p>
        ) : query.isError ? (
          <div className="invite-empty" role="alert">
            <p>{apiMessage(query.error)}</p>
            <button className="ws-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Guest / family</th>
                    <th>Family side</th>
                    <th>Invitation status</th>
                    <th>Last attempt</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.guests.map((guest) => (
                    <tr key={guest.id}>
                      <td>
                        <strong>{guest.name}</strong>
                        <span className="invite-email">{guest.email}</span>
                      </td>
                      <td>
                        <span
                          className={"invite-side " + guest.side.toLowerCase()}
                        >
                          {guest.side === "Both"
                            ? "Both sides"
                            : guest.side + "’s side"}
                        </span>
                      </td>
                      <td>
                        <span className={"invite-status " + guest.status}>
                          {invitationLabels[guest.status]}
                        </span>
                      </td>
                      <td>
                        {guest.lastAttemptAt
                          ? new Date(guest.lastAttemptAt).toLocaleString(
                              "en-IN",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Asia/Kolkata",
                              },
                            ) + " IST"
                          : "—"}
                      </td>
                      <td>
                        <div className="invite-row-actions">
                          <Link
                            className="ws-button"
                            to={"/app/guests/" + guest.id + "/invitation"}
                          >
                            {guest.status === "not_sent"
                              ? "Prepare invitation"
                              : "View invitation"}
                            <Icon name="arrow" />
                          </Link>
                          {guest.canEdit && (
                            <button
                              className="ws-text-link"
                              onClick={() => setForm(guest)}
                              aria-label={"Edit " + guest.name}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!query.data.guests.length && (
                    <tr>
                      <td colSpan={5}>
                        <div className="invite-empty">
                          <span className="dash-empty-symbol">
                            <Icon name="mail" />
                          </span>
                          <h2>
                            {search || side !== "All"
                              ? "No families match this view"
                              : "Good celebrations start with your people."}
                          </h2>
                          <p>
                            {search || side !== "All"
                              ? "Try another name or family side."
                              : "Add a guest or family with one email address. They won’t need an account to open your wedding website."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="invite-pagination">
              <span>
                {query.data.total} matching entries · Page {page}
              </span>
              <div>
                <button
                  className="ws-button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="ws-button"
                  disabled={page * query.data.pageSize >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="invite-caption">
        One entry can represent a whole family. No RSVP, guest limits or
        registration for your guests.
      </p>
    </div>
  );
}

function GuestForm({
  guest,
  userId,
  onClose,
}: {
  guest?: GuestRecord;
  userId: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const form = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: guest?.name || "",
      email: guest?.email || "",
      side: guest?.side || "Both",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof guestSchema>) =>
      saveGuest(values, guest),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["guests", userId] });
      if (guest)
        await cache.invalidateQueries({
          queryKey: ["invitation", userId, guest.id],
        });
      onClose();
    },
  });
  return (
    <section className="dash-card invite-add-card">
      <div className="invite-card-title">
        <h2>{guest ? "Edit guest / family" : "Bring your people together"}</h2>
        <button
          className="ws-button"
          onClick={onClose}
          disabled={mutation.isPending}
          aria-label="Close guest form"
        >
          <Icon name="close" />
        </button>
      </div>
      <form
        className="ws-form"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <fieldset disabled={mutation.isPending} className="invite-guest-fields">
          <label>
            Guest / family name
            <input
              autoFocus
              maxLength={120}
              placeholder="e.g. Gupta Parivar"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <small role="alert">{form.formState.errors.name.message}</small>
            )}
          </label>
          <label>
            Email address
            <input
              type="email"
              maxLength={254}
              placeholder="The family’s email address"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <small role="alert">{form.formState.errors.email.message}</small>
            )}
          </label>
          <label>
            Family side
            <select {...form.register("side")}>
              <option value="Bride">Bride’s side</option>
              <option value="Groom">Groom’s side</option>
              <option value="Both">Both sides</option>
            </select>
          </label>
        </fieldset>
        {guest?.status === "failed" && (
          <p className="invite-caption">
            Saving changes clears the rejected email draft. Prepare a fresh
            invitation with the corrected details.
          </p>
        )}
        {mutation.isError && (
          <p className="ws-form-error" role="alert">
            {apiMessage(mutation.error)}
          </p>
        )}
        <div className="invite-actions">
          <button
            className="ws-button ws-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save guest / family"}
          </button>
          <button
            type="button"
            className="ws-button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export function InvitationPage({
  userId,
  data,
}: {
  userId: string;
  data: Workspace;
}) {
  const { guestId = "" } = useParams();
  const query = useQuery({
    queryKey: ["invitation", userId, guestId],
    queryFn: () => getInvitation(guestId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    // Refresh configuration after a server restart without resetting the typed note.
    refetchInterval: (current) => {
      const invitation = current.state.data;
      if (
        invitation?.emailConfigured === false ||
        invitation?.guest.status === "sending"
      )
        return 3000;
      return false;
    },
  });
  if (signedOut(query.error)) return <Navigate to="/login" replace />;
  if (needsSetup(query.error)) return <Navigate to="/app/setup" replace />;
  if (query.isPending) return <p role="status">Opening your invitation…</p>;
  if (query.isError)
    return (
      <div className="invite-empty">
        <h1>Couldn’t open this invitation</h1>
        <p role="alert">{apiMessage(query.error)}</p>
        <button className="ws-button" onClick={() => query.refetch()}>
          Try again
        </button>
        <Link className="ws-button" to="/app/guests">
          Back to guests
        </Link>
      </div>
    );
  return (
    <InvitationEditor
      key={
        guestId +
        ":" +
        query.data.guest.version +
        ":" +
        query.data.weddingVersion
      }
      draft={query.data}
      data={data}
      userId={userId}
      onReload={() => query.refetch()}
    />
  );
}

function InvitationEditor({
  draft,
  data,
  userId,
  onReload,
}: {
  draft: InvitationDraft;
  data: Workspace;
  userId: string;
  onReload: () => void;
}) {
  const wedding = data.wedding!;
  const guest = draft.guest;
  const cache = useQueryClient();
  const form = useForm({
    resolver: zodResolver(emailSchema),
    mode: "onChange",
    defaultValues: { subject: draft.subject, message: draft.message },
  });
  const subject = form.watch("subject");
  const message = form.watch("message");
  const [previewValues, setPreviewValues] = useState({ subject, message });
  useEffect(() => {
    const timeout = setTimeout(
      () => setPreviewValues({ subject, message }),
      500,
    );
    return () => clearTimeout(timeout);
  }, [subject, message]);
  const notSent = guest.status === "not_sent";
  const validPreview = emailSchema.safeParse(previewValues).success;
  const preview = useQuery({
    queryKey: [
      "invitation-preview",
      userId,
      guest.id,
      guest.version,
      draft.weddingVersion,
      previewValues,
    ],
    queryFn: () =>
      previewInvitation(guest.id, {
        ...previewValues,
        version: guest.version,
        weddingVersion: draft.weddingVersion,
      }),
    enabled: notSent && validPreview,
  });
  const previewPending =
    notSent &&
    (preview.isFetching ||
      subject !== previewValues.subject ||
      message !== previewValues.message);
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof emailSchema>) =>
      notSent
        ? sendInvitation(guest.id, {
            ...values,
            version: guest.version,
            weddingVersion: draft.weddingVersion,
          })
        : retryInvitation(guest.id, guest.version),
    onSettled: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["invitation", userId, guest.id] }),
        cache.invalidateQueries({ queryKey: ["guests", userId] }),
      ]);
    },
  });
  const changedWedding = notSent && wedding.version !== draft.weddingVersion;
  const blocked =
    mutation.isPending ||
    !draft.emailConfigured ||
    changedWedding ||
    (!notSent && !guest.canRetry) ||
    (notSent && (!validPreview || previewPending || preview.isError));
  let sendLabel = "Send invitation now";
  if (mutation.isPending || guest.status === "sending")
    sendLabel = "Submitting…";
  else if (guest.status === "submitted") sendLabel = "Invitation submitted";
  else if (guest.canRetry) sendLabel = "Retry safely";
  else if (!notSent) sendLabel = "Check required";
  return (
    <div className="invite-page">
      <Link className="invite-breadcrumb" to="/app/guests">
        <Icon name="people" />
        Guests & Invites <span>/</span>
        {guest.name}
      </Link>
      <div className="dash-page-heading">
        <div>
          <span className="dash-kicker">
            A PERSONAL NOTE. A BEAUTIFUL BEGINNING.
          </span>
          <h1>Send email invitation</h1>
          <p>A warm welcome, with all the details your family needs.</p>
        </div>
        <span
          className={
            "invite-status " + (mutation.isPending ? "sending" : guest.status)
          }
          role="status"
        >
          {mutation.isPending ? "Submitting…" : invitationLabels[guest.status]}
        </span>
      </div>
      {!draft.emailConfigured && (
        <p className="invite-notice" role="status">
          <Icon name="mail" />
          <span>
            <strong>Email sender isn’t configured.</strong> Preview is
            available. Configure RESEND_API_KEY and RESEND_FROM in server/.env
            and restart the server before sending.
          </span>
          <button className="ws-button" onClick={onReload}>
            Refresh configuration
          </button>
        </p>
      )}
      {changedWedding && (
        <div className="invite-notice" role="alert">
          Wedding details have changed. Reload this draft to preview the latest
          details before sending.
          <button className="ws-button" onClick={onReload}>
            Reload draft
          </button>
        </div>
      )}
      {guest.status === "submitted" && (
        <p className="invite-success" role="status">
          <Icon name="circle-check" />
          <span>
            <strong>Submitted to Resend.</strong> Accepted on{" "}
            {new Date(guest.submittedAt!).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST. This confirms provider acceptance; inbox delivery isn’t tracked
            in V1.
          </span>
        </p>
      )}
      {guest.error && (
        <p className="invite-notice" role="alert">
          <Icon name="flag" />
          <span>{guest.error}</span>
        </p>
      )}
      <div className="invite-composer-grid">
        <form
          className="ws-form invite-compose"
          onSubmit={form.handleSubmit((values) => {
            if (!blocked) mutation.mutate(values);
          })}
        >
          <section className="dash-card invite-editor-card">
            <h2>
              <b>1</b>Recipient details
            </h2>
            <dl className="invite-details">
              <div>
                <dt>Guest / family</dt>
                <dd>{guest.name}</dd>
              </div>
              <div>
                <dt>Email address</dt>
                <dd>{guest.email}</dd>
              </div>
              <div>
                <dt>Family side</dt>
                <dd>
                  <span className={"invite-side " + guest.side.toLowerCase()}>
                    {guest.side === "Both"
                      ? "Both sides"
                      : guest.side + "’s side"}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="invite-caption">
              Saved in your guest directory.{" "}
              {guest.canEdit ? (
                <Link to="/app/guests">Edit contact details there.</Link>
              ) : (
                "Recipient locked after submission or an uncertain attempt."
              )}
            </p>
          </section>
          <section className="dash-card invite-editor-card">
            <h2>
              <b>2</b>Subject & personal note
            </h2>
            <fieldset
              disabled={!notSent || mutation.isPending}
              className="invite-email-fields"
            >
              <label>
                Email subject
                <input maxLength={240} {...form.register("subject")} />
                {form.formState.errors.subject && (
                  <small role="alert">
                    {form.formState.errors.subject.message}
                  </small>
                )}
              </label>
              <label>
                A note from your family
                <textarea
                  rows={6}
                  maxLength={3000}
                  {...form.register("message")}
                />
                {form.formState.errors.message && (
                  <small role="alert">
                    {form.formState.errors.message.message}
                  </small>
                )}
              </label>
            </fieldset>
            <p className="invite-caption">
              {notSent
                ? "The greeting and wedding details are added automatically. Your note can be in English or Hindi."
                : "This is the saved email from the original attempt. A safe retry sends this exact content."}
            </p>
          </section>
          <section className="dash-card invite-editor-card">
            <h2>
              <b>3</b>Wedding details, included
            </h2>
            {notSent ? (
              <dl className="invite-details">
                <div>
                  <dt>The couple</dt>
                  <dd>
                    {wedding.brideName} & {wedding.groomName}
                  </dd>
                </div>
                <div>
                  <dt>Ceremony</dt>
                  <dd>
                    {weddingDate(wedding.date)} · {wedding.startTime} IST
                  </dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>
                    {wedding.venue}
                    <small>
                      {wedding.address}, {wedding.city}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Directions</dt>
                  <dd>
                    <a
                      href={directions(wedding)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Maps ↗
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Family contact</dt>
                  <dd>
                    {wedding.contactRole}
                    <small>{wedding.phone}</small>
                  </dd>
                </div>
                {wedding.youtube && (
                  <div>
                    <dt>Livestream</dt>
                    <dd>YouTube link included</dd>
                  </div>
                )}
                <div>
                  <dt>Guest website</dt>
                  <dd>
                    <Link to={"/w/" + wedding.publicId} target="_blank">
                      Open wedding website ↗
                    </Link>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="invite-caption">
                The preview shows the wedding details saved at the first
                attempt. The linked guest website always shows the latest
                wedding details.
              </p>
            )}
          </section>
          {mutation.isError && (
            <p className="ws-form-error" role="alert">
              {apiMessage(mutation.error)} Reload the status before trying
              again.
              <button type="button" className="ws-button" onClick={onReload}>
                Refresh status
              </button>
            </p>
          )}
          <div className="invite-actions">
            <button className="ws-button ws-primary" disabled={blocked}>
              <Icon name="mail" />
              {sendLabel}
            </button>
            <Link className="ws-button" to="/app/guests">
              Back to guests
            </Link>
            {!notSent && (
              <button
                type="button"
                className="ws-button"
                onClick={onReload}
                disabled={mutation.isPending}
              >
                Refresh status
              </button>
            )}
          </div>
          <p className="invite-caption">
            Sent individually through Resend. No automatic reminders or
            scheduling. “Submitted” means accepted by the provider, not
            delivered.
          </p>
        </form>
        <aside className="invite-preview-panel" aria-label="Email preview">
          <div className="invite-preview-heading">
            <span>
              <i />
              {notSent ? "LIVE EMAIL PREVIEW" : "SAVED EMAIL PREVIEW"}
            </span>
            <small>
              {notSent && !validPreview
                ? "Complete subject and note to update"
                : previewPending
                  ? "Updating…"
                  : "Exactly what we send"}
            </small>
          </div>
          {notSent && preview.isError && (
            <p className="ws-form-error" role="alert">
              {apiMessage(preview.error)}{" "}
              <button className="ws-button" onClick={() => preview.refetch()}>
                Refresh preview
              </button>
            </p>
          )}
          <iframe
            title="Wedding invitation email preview"
            sandbox=""
            srcDoc={notSent ? preview.data?.html || draft.html : draft.html}
            className="invite-preview-frame"
          />
          <p className="invite-caption">
            Email app appearance may vary. Guests open the wedding website
            without signing in.
          </p>
        </aside>
      </div>
    </div>
  );
}
