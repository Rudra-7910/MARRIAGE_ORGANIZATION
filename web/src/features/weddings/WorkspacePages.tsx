import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import type { IconName } from "../../components/ui/Icon";
import type { AuthUser } from "../../lib/api";
import { directions, weddingDate } from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";

function PageHeading({
  title,
  description,
  label = "YOUR WEDDING WORKSPACE",
}: {
  title: string;
  description: string;
  label?: string;
}) {
  return (
    <div className="dash-page-heading">
      <div>
        <span className="dash-kicker">{label}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function EmptySection({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <div className="dash-empty-section">
      <span className="dash-empty-symbol">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="dash-badge">Coming soon</span>
    </div>
  );
}

export function FunctionsPage({ data }: { data: Workspace }) {
  const wedding = data.wedding!;
  return (
    <>
      <PageHeading
        title="Functions & ceremonies"
        description="Every little ritual. Every big celebration. One shared schedule."
      />
      <div className="dash-section-heading">
        <h2>Your celebration</h2>
        <button
          className="ws-button"
          disabled
          title="Additional functions will be connected in a later step"
        >
          <Icon name="plus" />
          Add function · coming soon
        </button>
      </div>
      <section className="dash-card dash-function-card">
        <div className="dash-function-date">
          <span>
            {new Date(wedding.date + "T12:00:00").toLocaleDateString("en-IN", {
              month: "short",
            })}
          </span>
          <strong>{wedding.date.slice(8)}</strong>
          <span>{wedding.date.slice(0, 4)}</span>
        </div>
        <div>
          <span className="dash-badge">Main wedding</span>
          <h2>
            {wedding.brideName} & {wedding.groomName}
          </h2>
          <p>
            <Icon name="clock" />
            {wedding.startTime}
            {wedding.endTime ? " – " + wedding.endTime : ""} IST
          </p>
          <p>
            <Icon name="pin" />
            {wedding.venue}, {wedding.city}
          </p>
        </div>
        <div className="dash-function-actions">
          <a
            className="ws-button"
            href={directions(wedding)}
            target="_blank"
            rel="noreferrer"
          >
            Get directions ↗
          </a>
          {data.role === "Organizer" && (
            <Link className="ws-text-link" to="/app/wedding/edit">
              Edit details <Icon name="arrow" />
            </Link>
          )}
        </div>
      </section>
      <div className="dash-card">
        <EmptySection
          icon="calendar"
          title="Room for all your wedding moments"
          description="Separate Haldi, Mehendi, Sangeet and reception schedules will live here when function management is connected. Your main wedding above already uses your saved details."
        />
      </div>
    </>
  );
}

export function TeamsPage() {
  return (
    <>
      <PageHeading
        title="Teams & Services"
        description="Family helpers and vendors, with everyone working from the same plan."
      />
      <div className="dash-section-heading">
        <div>
          <h2>Your departments</h2>
          <p>To do, in progress or done. Simple updates everyone can follow.</p>
        </div>
        <button className="ws-button" disabled>
          <Icon name="plus" />
          Add service · coming soon
        </button>
      </div>
      <section className="dash-card">
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Department / service</th>
                <th>Status</th>
                <th>Last update</th>
                <th>Contact</th>
                <th>Next deadline</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <EmptySection
                    icon="people"
                    title="A shared place for your people"
                    description="Department contacts, progress updates and attention flags will appear here when service tracking is connected."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="dash-starting-points">
        <span className="dash-kicker">A FEW PLACES TO START</span>
        <div>
          {[
            { name: "Catering", icon: "food" },
            { name: "Photography", icon: "camera" },
            { name: "Tent & lighting", icon: "tent" },
            { name: "Decoration", icon: "spark" },
          ].map((item) => (
            <Link key={item.name} to="/app/services">
              <Icon name={item.icon as IconName} />
              <span>{item.name}</span>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
        <p>Suggestions for planning, not assigned departments.</p>
      </section>
    </>
  );
}

export function BudgetPage() {
  return (
    <>
      <PageHeading
        title="Budget & Expenses"
        description="Just what’s agreed, what’s paid and what’s still due."
        label="PRIVATE TO WEDDING ORGANIZERS"
      />
      <div className="dash-privacy-note">
        <Icon name="lock" />
        <p>
          Only wedding organizers can open this section. Your guests, helpers
          and workers won’t see it.
        </p>
      </div>
      <div className="dash-budget-stats">
        {["Wedding budget", "Agreed cost", "Amount paid", "Pending dues"].map(
          (label) => (
            <div className="dash-card" key={label}>
              <span>{label}</span>
              <strong>—</strong>
            <small>Expense tracking coming soon</small>
            </div>
          ),
        )}
      </div>
      <section className="dash-card">
        <div className="dash-card-heading">
          <h2>Service-wise expenses</h2>
          <button className="ws-button" disabled>
            <Icon name="plus" />
            Add expense · coming soon
          </button>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Agreed amount</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <EmptySection
                    icon="wallet"
                    title="A clear picture, without the spreadsheets"
                    description="Service costs and pending dues will be connected in a later step. No sample amounts are included in your wedding."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function PhotosPage() {
  const [tab, setTab] = useState("Awaiting review");
  return (
    <>
      <PageHeading
        title="Photos & gallery"
        description="Every perspective. Every little moment. Your wedding, remembered together."
      />
      <div className="dash-photo-banner">
        <Icon name="camera" />
        <div>
          <span className="dash-kicker">MEMORIES, MADE TOGETHER</span>
          <h2>A place for everyone’s favourite moments.</h2>
          <p>
            Guest uploads and organizer approval are coming soon. Only approved
            photos will become visible in the shared gallery.
          </p>
        </div>
      </div>
      <div className="dash-section-heading">
        <div className="dash-tabs" aria-label="Photo moderation views">
          {["Awaiting review", "Approved gallery", "Rejected"].map((label) => (
            <button
              key={label}
              className={tab === label ? "is-active" : ""}
              aria-pressed={tab === label}
              onClick={() => setTab(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="ws-button" disabled>
          <Icon name="camera" />
          Upload photos · coming soon
        </button>
      </div>
      <section className="dash-card">
        <EmptySection
          icon="camera"
          title={
            tab === "Awaiting review"
              ? "Your wedding memories will begin here"
              : tab === "Approved gallery"
                ? "Your approved gallery"
                : "Rejected photos"
          }
          description="Photo storage, QR uploads and moderation aren’t connected yet. This wedding has no sample photographs."
        />
      </section>
    </>
  );
}

export function PeoplePage({
  user,
  data,
}: {
  user: AuthUser;
  data: Workspace;
}) {
  return (
    <>
      <PageHeading
        title="People & Access"
        description="A shared celebration, with the right access for everyone."
      />
      <section className="dash-card">
        <div className="dash-card-heading">
          <h2>Your access</h2>
          <span className="dash-badge">
            <Icon name="lock" />
            Server verified
          </span>
        </div>
        <div className="dash-person">
          <span className="dash-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>
              {user.name} <small>(you)</small>
            </strong>
            <p>{user.email}</p>
          </div>
          <span className="dash-badge">{data.role}</span>
        </div>
      </section>
      <div className="dash-access-grid">
        {[
          {
            name: "Organizer",
            icon: "settings",
            text: "Edit wedding details and manage the shared wedding space. Budget information stays with organizers.",
          },
          {
            name: "Manager",
            icon: "people",
            text: "Coordinate their department and see progress across other departments.",
          },
          {
            name: "Worker",
            icon: "check",
            text: "Follow assigned work and view department progress without access to private spending.",
          },
        ].map((role) => (
          <section className="dash-card" key={role.name}>
            <Icon name={role.icon as IconName} />
            <h2>{role.name}</h2>
            <p>{role.text}</p>
          </section>
        ))}
      </div>
      <div className="dash-bottom-note">
        <Icon name="people" />
        <p>
          Inviting more family members and changing team access will be
          connected in a later step. Your current wedding role is already
          checked by the server.
        </p>
        <button className="ws-button" disabled>
          <Icon name="plus" />
          Invite member · coming soon
        </button>
      </div>
    </>
  );
}

export function GuestWebsitePage({ data }: { data: Workspace }) {
  const [copyStatus, setCopyStatus] = useState("");
  const wedding = data.wedding!;
  const url = window.location.origin + "/w/" + wedding.publicId;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link copied");
    } catch {
      setCopyStatus("Select the link below to copy it manually.");
    }
  }
  return (
    <>
      <PageHeading
        title="Your guest website"
        description="A warm welcome, the right directions and all the details your guests need."
        label="ONE LINK. EVERYONE IN THE LOOP."
      />
      <div className="dash-website-grid">
        <div>
          <section className="dash-card">
            <div className="dash-card-heading">
              <h2>
                <Icon name="link" />
                Share your wedding
              </h2>
              <span className="dash-badge">Live</span>
            </div>
            <div className="dash-card-body">
              <p>Guests can open this website without logging in.</p>
              <label className="guest-link-label">
                Your wedding website
                <input
                  readOnly
                  value={url}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="dash-button-row">
                <button className="ws-button ws-primary" onClick={copyLink}>
                  <Icon name="link" />
                  Copy link
                </button>
                <a
                  className="ws-button"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit website ↗
                </a>
              </div>
              <p role="status" className="ws-help">
                {copyStatus}
              </p>
            </div>
          </section>
          <section className="dash-card">
            <div className="dash-card-heading">
              <h2>What your guests will see</h2>
              {data.role === "Organizer" && (
                <Link className="dash-inline-link" to="/app/wedding/edit">
                  Edit details <Icon name="arrow" />
                </Link>
              )}
            </div>
            <div className="dash-card-body">
              <ul className="dash-website-checklist">
                {[
                  "Couple names, wedding date and ceremony time",
                  "Venue, address and Google Maps directions",
                  "Your guest-facing organizer contact",
                  "Welcome note and optional YouTube livestream",
                ].map((label) => (
                  <li key={label}>
                    <Icon name="check" />
                    {label}
                  </li>
                ))}
              </ul>
              <p className="dash-sync-note">
                <Icon name="circle-check" />
                Wedding changes appear here and on the guest website
                automatically.
              </p>
            </div>
          </section>
        </div>
        <section className="dash-website-preview">
          <div className="dash-preview-browser">
            <i />
            <i />
            <i />
            <span>YOUR LIVE WEDDING DETAILS</span>
          </div>
          <div className="dash-preview-invitation">
            <span>TOGETHER WITH THEIR FAMILIES</span>
            <h2>
              {wedding.brideName}
              <em>&</em>
              {wedding.groomName}
            </h2>
            <p>{weddingDate(wedding.date)}</p>
            <strong>{wedding.venue}</strong>
            <p>{wedding.city}</p>
            <span>You’re warmly invited</span>
          </div>
          <Link className="dash-inline-link" to={"/w/" + wedding.publicId}>
            Open full guest website <Icon name="arrow" />
          </Link>
        </section>
      </div>
    </>
  );
}
