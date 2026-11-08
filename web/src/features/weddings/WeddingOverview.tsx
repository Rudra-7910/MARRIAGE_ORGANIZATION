import { apiMessage } from "../../lib/api";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../components/ui/Icon";
import {
  canOrganize,
  directions,
  weddingDate,
  weddingTime,
} from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import { getGuests, invitationLabels } from "../../lib/invitations";
import { NearbyServices } from "./ServicesPage";
import { WeddingCountdown } from "./WeddingCountdown";
import { getPlanning, planningTime } from "../../lib/planning";
import { getFinanceSummary, inr } from "../../lib/finance";

export function WeddingOverview({
  data,
  userId,
}: {
  data: Workspace;
  userId: string;
}) {
  const wedding = data.wedding!;
  const organizer = canOrganize(data.role);
  const planning = useQuery({
    queryKey: ["planning", userId],
    queryFn: ({ signal }) => getPlanning(signal),
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const params = { page: 1, search: "", side: "All" };
  const invitations = useQuery({
    queryKey: ["guests", userId, params],
    queryFn: ({ signal }) => getGuests(params, signal),
    enabled: organizer,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const finance = useQuery({
    queryKey: ["finance-summary", userId],
    queryFn: ({ signal }) => getFinanceSummary(signal),
    enabled: organizer,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const upcoming = (planning.data?.functions || [])
    .filter(
      (item) =>
        new Date(
          item.endsAt.length === 16 ? item.endsAt + ":00+05:30" : item.endsAt,
        ).getTime() > Date.now(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  return (
    <div className="celebration-overview">
      <div className="celebration-overview-heading">
        <div>
          <h1>Your wedding overview</h1>
          <p>{data.family?.name}</p>
        </div>
        <span className="celebration-private">
          <Icon name="lock" />
          Private workspace
        </span>
      </div>
      {organizer &&
        invitations.data &&
        invitations.data.summary.attention > 0 && (
          <section
            className="celebration-attention"
            aria-label="Needs your attention"
          >
            <Icon name="flag" />
            <div>
              <strong>Needs your attention</strong>
              <p>
                {invitations.data.summary.attention} invitation
                {invitations.data.summary.attention === 1 ? "" : "s"} need
                review. Check the saved result before retrying.
              </p>
            </div>
            <Link to="/app/guests" className="ws-button">
              Review invitations <Icon name="arrow" />
            </Link>
          </section>
        )}
      <section className="celebration-organizer-hero">
        <div className="celebration-organizer-art" aria-hidden="true">
          <span>॥ शुभ विवाह ॥</span>
          <strong>
            {wedding.brideName.slice(0, 1)}
            <span>&</span>
            {wedding.groomName.slice(0, 1)}
          </strong>
        </div>
        <div className="celebration-organizer-identity">
          <h2>
            {wedding.brideName} <span>&</span> {wedding.groomName}
          </h2>
          <div className="celebration-organizer-date">
            <time dateTime={wedding.date}>{weddingDate(wedding.date)}</time>
            <p>
              <Icon name="clock" />
              <time
                dateTime={wedding.date + "T" + wedding.startTime + ":00+05:30"}
              >
                {weddingTime(wedding.startTime)} IST
              </time>
              <span>Wedding ceremony / shubh muhurat</span>
            </p>
          </div>
          <p className="celebration-organizer-place">
            <Icon name="pin" />
            <span>
              <strong>{wedding.venue}</strong>
              {wedding.city}
            </span>
          </p>
        </div>
        <WeddingCountdown
          date={wedding.date}
          time={wedding.startTime}
          detailsHref="#wedding-details"
        />
        <div className="celebration-actions">
          {organizer && (
            <>
              <Link className="ws-button ws-primary" to="/app/guests">
                <Icon name="mail" />
                Prepare invitation
              </Link>
              <Link className="ws-button" to="/app/wedding/edit">
                <Icon name="settings" />
                Edit wedding
              </Link>
            </>
          )}
          <Link
            className="ws-button"
            to={"/w/" + wedding.publicId}
            target="_blank"
          >
            <Icon name="eye" />
            Preview guest website
          </Link>
        </div>
      </section>
      {organizer && (
        <section
          className="plan-overview overview-finance"
          aria-label="Private spending summary"
        >
          <div className="celebration-card-heading">
            <div>
              <h2>Budget summary</h2>
              <p>Visible to your wedding’s organizers only.</p>
            </div>
            <Link className="ws-text-link" to="/app/budget">
              Open budget <Icon name="arrow" />
            </Link>
          </div>
          {finance.isPending ? (
            <p role="status">Loading spending totals…</p>
          ) : finance.isError ? (
            <div role="alert">
              <p>{apiMessage(finance.error)}</p>
              <button className="ws-button" onClick={() => finance.refetch()}>
                Reload spending
              </button>
            </div>
          ) : (
            finance.data && (
              <div className="plan-metrics">
                {[
                  {
                    label: "Wedding budget",
                    value:
                      finance.data.budgetPaise === null
                        ? "Not set"
                        : inr(finance.data.budgetPaise),
                  },
                  {
                    label: "Agreed costs",
                    value: inr(finance.data.totals.agreedPaise),
                  },
                  {
                    label: "Paid so far",
                    value: inr(finance.data.totals.paidPaise),
                  },
                  {
                    label: "Pending dues",
                    value: inr(finance.data.totals.pendingPaise),
                  },
                ].map((item) => (
                  <div className="plan-metric" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="plan-overview" aria-label="Upcoming functions">
          <div className="celebration-card-heading">
            <h2>Upcoming functions</h2>
            <Link className="ws-text-link" to="/app/functions">
              All functions <Icon name="arrow" />
            </Link>
          </div>
          {upcoming.map((item) => (
            <div className="plan-overview-row" key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <span>{item.venue}</span>
              </span>
              <time dateTime={item.startsAt}>
                {planningTime(item.startsAt)}
              </time>
            </div>
          ))}
        </section>
      )}
      <section className="plan-overview" aria-label="Wedding coordination">
        <div className="celebration-card-heading">
          <div>
            <h2>Department progress</h2>
          </div>
          <Link className="ws-text-link" to="/app/departments">
            Open shared plan <Icon name="arrow" />
          </Link>
        </div>
        {planning.isPending ? (
          <p role="status">Loading your departments…</p>
        ) : planning.isError ? (
          <div role="alert">
            <p>{apiMessage(planning.error)}</p>
            <button className="ws-button" onClick={() => planning.refetch()}>
              Reload plan
            </button>
          </div>
        ) : (
          planning.data && (
            <>
              <div className="plan-metrics">
                <div className="plan-metric">
                  <span>Departments</span>
                  <strong>{planning.data.departments.length}</strong>
                  <small>Family teams & vendors</small>
                </div>
                <div className="plan-metric">
                  <span>In progress</span>
                  <strong>
                    {
                      planning.data.departments.filter(
                        (item) => item.status === "In progress",
                      ).length
                    }
                  </strong>
                </div>
                <div className="plan-metric">
                  <span>Done</span>
                  <strong>
                    {
                      planning.data.departments.filter(
                        (item) => item.status === "Done",
                      ).length
                    }
                  </strong>
                </div>
                <div className="plan-metric">
                  <span>Need attention</span>
                  <strong>
                    {
                      planning.data.departments.filter(
                        (item) => item.attentionReasons.length,
                      ).length
                    }
                  </strong>
                  <Link to="/app/attention" className="ws-text-link">
                    Review requests
                  </Link>
                </div>
              </div>
              {planning.data.departments.length ? (
                planning.data.departments.slice(0, 4).map((item) => (
                  <div className="plan-overview-row" key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <span
                        className={
                          "plan-status " +
                          item.status.toLowerCase().replaceAll(" ", "-")
                        }
                      >
                        {item.status}
                      </span>
                    </span>
                    <span>
                      {item.completed} / {item.total} checklist items done
                      {item.attentionReasons.length ? ". Needs attention" : ""}
                    </span>
                  </div>
                ))
              ) : (
                <p className="plan-muted">
                  No departments yet. Add a department or start with the
                  wedding checklist.
                </p>
              )}
            </>
          )
        )}
      </section>
      <div className="celebration-overview-grid">
        <section className="celebration-overview-next">
          <div className="celebration-card-heading">
            <h2>Quick actions</h2>
          </div>
          {organizer && (
            <Link className="celebration-next-step" to="/app/guests">
              <span>
                <Icon name="people" />
              </span>
              <div>
                <h3>Add a guest / family</h3>
                <p>
                  Add a name and email address, then prepare their invitation.
                </p>
                <strong>
                  Open guest directory <Icon name="arrow" />
                </strong>
              </div>
            </Link>
          )}
          <Link
            className="celebration-next-step"
            to={"/w/" + wedding.publicId}
            target="_blank"
          >
            <span>
              <Icon name="globe" />
            </span>
            <div>
              <h3>Review your guest website</h3>
              <p>
                Check your welcome note, date, directions and the family
                contact.
              </p>
              <strong>
                Open guest website <Icon name="arrow" />
              </strong>
            </div>
          </Link>
        </section>
        <section className="celebration-detail-card" id="wedding-details">
          <div className="celebration-card-heading">
            <h2>Ceremony & venue</h2>
            <Icon name="calendar" />
          </div>
          <dl className="celebration-overview-details">
            <div>
              <dt>Day & shubh muhurat</dt>
              <dd>
                <time dateTime={wedding.date}>{weddingDate(wedding.date)}</time>
                <small>
                  {weddingTime(wedding.startTime)}
                  {wedding.endTime
                    ? " – " + weddingTime(wedding.endTime)
                    : ""}{" "}
                  IST
                </small>
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
              <dt>Family contact</dt>
              <dd>
                {wedding.contactRole}
                <a href={"tel:" + wedding.phone.replace(/[^+\d]/g, "")}>
                  {wedding.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt>Directions</dt>
              <dd>
                <a
                  className="ws-button"
                  href={directions(wedding)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="pin" />
                  Open in Google Maps
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {organizer && (
        <section className="celebration-invitation-summary">
          <div className="celebration-card-heading">
            <div>
              <h2>Guests & invitations</h2>
            </div>
            <Link className="ws-text-link" to="/app/guests">
              View all families <Icon name="arrow" />
            </Link>
          </div>
          {invitations.isPending ? (
            <p className="celebration-empty" role="status">
              Loading your saved invitations…
            </p>
          ) : invitations.isError ? (
            <div className="celebration-empty" role="alert">
              <p>{apiMessage(invitations.error)}</p>
              <button
                className="ws-button"
                onClick={() => invitations.refetch()}
              >
                Try again
              </button>
            </div>
          ) : (
            invitations.data && (
              <>
                <div className="celebration-invitation-metrics">
                  {[
                    {
                      label: "Family entries",
                      value: invitations.data.summary.total,
                      note: "Your saved guest list",
                    },
                    {
                      label: "Submitted",
                      value: invitations.data.summary.submitted,
                      note: "Accepted by email provider",
                    },
                    {
                      label: "Not sent",
                      value: invitations.data.summary.notSent,
                      note: "Ready for a personal invitation",
                    },
                    {
                      label: "Need attention",
                      value: invitations.data.summary.attention,
                      note: "Failed or unconfirmed attempts",
                    },
                  ].map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <small>{metric.note}</small>
                    </div>
                  ))}
                </div>
                {invitations.data.guests.length ? (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Guest / family</th>
                          <th>Side</th>
                          <th>Email status</th>
                          <th>
                            <span className="sr-only">View invitation</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.data.guests.slice(0, 5).map((guest) => (
                          <tr key={guest.id}>
                            <td>
                              <strong>{guest.name}</strong>
                              <small className="invite-email">
                                {guest.email}
                              </small>
                            </td>
                            <td>
                              <span
                                className={
                                  "invite-side " + guest.side.toLowerCase()
                                }
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
                              <Link
                                className="ws-button"
                                to={"/app/guests/" + guest.id + "/invitation"}
                                aria-label={"View invitation for " + guest.name}
                              >
                                <Icon name="eye" />
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="celebration-empty">
                    <Icon name="mail" />
                    <h3>No guest families yet</h3>
                    <p>
                      Add a guest or family with an email address to prepare
                      their invitation.
                    </p>
                    <Link className="ws-button ws-primary" to="/app/guests">
                      Add your first guest <Icon name="plus" />
                    </Link>
                  </div>
                )}
                <p className="celebration-caption">
                  Submitted means accepted by the email provider. Inbox delivery
                  is not tracked.
                </p>
              </>
            )
          )}
        </section>
      )}
      <NearbyServices wedding={wedding} />
    </div>
  );
}
