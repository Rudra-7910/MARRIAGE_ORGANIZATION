import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import { directions, weddingDate } from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import { NearbyServices } from "./ServicesPage";

export function WeddingOverview({ data }: { data: Workspace }) {
  const wedding = data.wedding!;
  return (
    <>
      <div className="dash-page-heading">
        <div>
          <span className="dash-kicker">
            <span className="dash-status-dot" />
            {data.family?.name} · YOUR SHARED PLAN
          </span>
          <h1>Your wedding, at a glance</h1>
          <p>
            A little less following up. More time for the moments that matter.
          </p>
        </div>
        {data.role === "Organizer" && (
          <Link className="ws-button ws-primary" to="/app/wedding/edit">
            <Icon name="settings" />
            Edit wedding
          </Link>
        )}
      </div>

      <div className="dash-stats-strip">
        <Link to="/app/functions">
          <span className="dash-stat-icon">
            <Icon name="calendar" />
          </span>
          <div>
            <small>THE BIG DAY</small>
            <strong>{weddingDate(wedding.date)}</strong>
            <span>
              {wedding.startTime} IST · {wedding.city}
            </span>
          </div>
          <Icon name="arrow" />
        </Link>
        <Link to="/app/guests">
          <span className="dash-stat-icon blush">
            <Icon name="mail" />
          </span>
          <div>
            <small>GUEST EMAIL INVITES</small>
            <strong>Your people, together</strong>
            <span>Invitation tracking coming soon</span>
          </div>
          <Icon name="arrow" />
        </Link>
        <Link to="/app/photos">
          <span className="dash-stat-icon sand">
            <Icon name="camera" />
          </span>
          <div>
            <small>WEDDING MEMORIES</small>
            <strong>A place for every moment</strong>
            <span>Photo collection coming soon</span>
          </div>
          <Icon name="arrow" />
        </Link>
      </div>

      <div className="dash-overview-grid">
        <section className="dash-card dash-attention">
          <div className="dash-card-heading">
            <h2>
              <Icon name="flag" />
              Needs Your Attention
            </h2>
            <span className="dash-badge sand">Follow-ups</span>
          </div>
          <div className="dash-attention-empty">
            <span className="dash-empty-symbol">
              <Icon name="flag" />
            </span>
            <h3>Every follow-up, in one place.</h3>
            <p>
              Department requests and overdue updates will appear here when
              service tracking is connected.
            </p>
            <Link to="/app/departments" className="ws-button">
              Explore Teams & Services <Icon name="arrow" />
            </Link>
          </div>
          <div className="dash-card-footnote">
            <Icon name="phone" />
            <span>
              For now, keep your wedding contact up to date so everyone knows
              whom to call.
            </span>
          </div>
        </section>

        <section className="dash-card dash-ceremony">
          <div className="dash-ceremony-cover">
            <span className="dash-badge">YOUR CELEBRATION</span>
            <div>
              <small>THE WEDDING OF</small>
              <h2>
                {wedding.brideName} <em>&</em> {wedding.groomName}
              </h2>
            </div>
            <span className="dash-ceremony-flower" aria-hidden="true">
              ✳
            </span>
          </div>
          <div className="dash-ceremony-details">
            <p>
              <Icon name="calendar" />
              <span>
                <strong>{weddingDate(wedding.date)}</strong>
                {wedding.startTime}
                {wedding.endTime ? " – " + wedding.endTime : ""} IST
              </span>
            </p>
            <p>
              <Icon name="pin" />
              <span>
                <strong>{wedding.venue}</strong>
                {wedding.address}, {wedding.city}
              </span>
            </p>
            <p>
              <Icon name="people" />
              <span>
                <strong>{wedding.contactRole}</strong>
                <a href={"tel:" + wedding.phone}>{wedding.phone}</a>
              </span>
            </p>
            <div className="dash-ceremony-actions">
              <Link className="ws-button" to="/app/functions">
                View ceremony
              </Link>
              <a
                className="ws-button ws-primary"
                href={directions(wedding)}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="pin" />
                Google Maps ↗
              </a>
            </div>
          </div>
        </section>
      </div>

      <section className="dash-card">
        <div className="dash-card-heading">
          <div>
            <h2>Teams & Services</h2>
            <p>
              One shared view of your departments, family helpers and vendors.
            </p>
          </div>
          <Link className="dash-inline-link" to="/app/departments">
            View all <Icon name="arrow" />
          </Link>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Work status</th>
                <th>Last update</th>
                <th>Next deadline</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="dash-table-empty">
                    <Icon name="people" />
                    <strong>Your team’s updates belong here.</strong>
                    <p>
                      Service tracking is coming soon. You can explore nearby
                      wedding services below.
                    </p>
                    <Link className="dash-inline-link" to="/app/services">
                      Find services near {wedding.city} <Icon name="arrow" />
                    </Link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="dash-overview-grid">
        {data.role === "Organizer" && (
          <section className="dash-card">
            <div className="dash-card-heading">
              <h2>
                <Icon name="wallet" />
                Spending Summary
              </h2>
              <span className="dash-badge">
                <Icon name="lock" />
                Organizers only
              </span>
            </div>
            <div className="dash-money-grid">
              {["Budget", "Agreed cost", "Paid", "Pending dues"].map(
                (label) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>—</strong>
                  <small>Available soon</small>
                  </div>
                ),
              )}
            </div>
            <div className="dash-card-bottom">
              <p>Your family’s spending stays private.</p>
              <Link className="dash-inline-link" to="/app/budget">
                Budget & Expenses <Icon name="arrow" />
              </Link>
            </div>
          </section>
        )}
        <section className="dash-card">
          <div className="dash-card-heading">
            <h2>
              <Icon name="clock" />
              Recent Updates
            </h2>
            <span className="dash-badge">Latest save</span>
          </div>
          <div className="dash-update-entry">
            <span className="dash-update-icon">
              <Icon name="check" />
            </span>
            <div>
              <strong>
                {wedding.brideName} & {wedding.groomName}
              </strong>
              <p>
                Current wedding details are shared with your dashboard and guest
                website.
              </p>
              <time dateTime={wedding.updatedAt}>
                Last saved{" "}
                {new Date(wedding.updatedAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </time>
            </div>
          </div>
          <div className="dash-card-bottom">
            <span>Same details. Everyone in the loop.</span>
            <Link className="dash-inline-link" to="/app/guest-website">
              Guest website <Icon name="arrow" />
            </Link>
          </div>
        </section>
      </div>

      <NearbyServices wedding={wedding} />

      <section className="dash-share-banner">
        <span className="dash-share-icon">
          <Icon name="globe" />
        </span>
        <div>
          <small>FOR THE PEOPLE WHO MAKE IT YOURS</small>
          <h2>Your guest website is ready.</h2>
          <p>
            Dates, directions and a warm welcome. Your guests don’t need an
            account.
          </p>
        </div>
        <Link className="ws-button ws-primary" to="/app/guest-website">
          Open guest website settings <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
