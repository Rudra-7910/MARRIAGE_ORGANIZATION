import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import { canOrganize, weddingDate } from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";

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
      <div className="dash-page-heading">
        <div>
          <h1>Your guest website</h1>
          <p>Share ceremony details, directions and family contact information.</p>
        </div>
      </div>
      <div className="dash-website-grid">
        <div>
          <section className="dash-card">
            <div className="dash-card-heading">
              <h2>
                <Icon name="link" />
                Share your wedding
              </h2>
              <span className="dash-badge">Public</span>
            </div>
            <div className="dash-card-body">
              <p>
                Guests can open this website without logging in. This generic
                link shows only functions marked public. Use Guests &
                Invitations for personal function access.
              </p>
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
                  Visit website
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
              {canOrganize(data.role) && (
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
                  "Published guest updates and the approved photo gallery",
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
            <span>Your saved wedding details</span>
          </div>
          <div className="dash-preview-invitation">
            <span>Together with their families</span>
            <h2>
              {wedding.brideName}
              <span>&</span>
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
