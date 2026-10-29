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

export function WeddingOverview({
  data,
  userId,
}: {
  data: Workspace;
  userId: string;
}) {
  const wedding = data.wedding!;
  const organizer = canOrganize(data.role);
  const params = { page: 1, search: "", side: "All" };
  const invitations = useQuery({
    queryKey: ["guests", userId, params],
    queryFn: ({ signal }) => getGuests(params, signal),
    enabled: organizer,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  return (
    <div className="celebration-overview">
      <div className="celebration-overview-heading">
        <div>
          <span className="celebration-kicker">
            {data.family?.name} · YOUR SHARED WEDDING SPACE
          </span>
          <h1>Your celebration, in motion.</h1>
          <p>A little less following up. A little more together.</p>
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
            <em>&</em>
            {wedding.groomName.slice(0, 1)}
          </strong>
          <p>A beautiful beginning.</p>
        </div>
        <div className="celebration-organizer-identity">
          <span className="celebration-kicker">
            YOUR PEOPLE. YOUR PLANS. YOUR BIG DAY.
          </span>
          <h2>
            {wedding.brideName} <em>&</em> {wedding.groomName}
          </h2>
          <div className="celebration-organizer-date">
            <span className="celebration-kicker">THE WEDDING DAY</span>
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
      <div className="celebration-overview-grid">
        <section className="celebration-overview-next">
          <div className="celebration-card-heading">
            <h2>Your next steps</h2>
            <span>ONE THING AT A TIME</span>
          </div>
          {organizer && (
            <Link className="celebration-next-step" to="/app/guests">
              <span>
                <Icon name="people" />
              </span>
              <div>
                <h3>Add a guest / family</h3>
                <p>
                  Bring your favourite people together. A name, an email, a
                  little love.
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
                See their experience <Icon name="arrow" />
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
              <dt>THE DAY & SHUBH MUHURAT</dt>
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
              <dt>THE PLACE</dt>
              <dd>
                {wedding.venue}
                <small>
                  {wedding.address}, {wedding.city}
                </small>
              </dd>
            </div>
            <div>
              <dt>FAMILY CONTACT</dt>
              <dd>
                {wedding.contactRole}
                <a href={"tel:" + wedding.phone.replace(/[^+\d]/g, "")}>
                  {wedding.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt>DIRECTIONS</dt>
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
              <span className="celebration-kicker">
                A PERSONAL WELCOME FOR YOUR PEOPLE
              </span>
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
                    <h3>Your people belong here.</h3>
                    <p>
                      Add your first family and send an invitation with your own
                      words.
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
      <section className="celebration-planned">
        <div className="celebration-card-heading">
          <h2>A little more, on the way.</h2>
          <span>COMING NEXT</span>
        </div>
        <div>
          {[
            {
              title: "Teams & Services",
              text: "A place for your family, helpers and wedding team.",
              href: "/app/departments",
              icon: "people" as const,
            },
            ...(organizer
              ? [
                  {
                    title: "Budget & Expenses",
                    text: "Keep agreed costs and pending dues together.",
                    href: "/app/budget",
                    icon: "wallet" as const,
                  },
                ]
              : []),
            {
              title: "Wedding memories",
              text: "A shared home for the moments you’ll keep.",
              href: "/app/photos",
              icon: "camera" as const,
            },
          ].map((module) => (
            <Link key={module.title} to={module.href}>
              <Icon name={module.icon} />
              <h3>{module.title}</h3>
              <p>{module.text}</p>
              <span>
                Coming next <Icon name="arrow" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
