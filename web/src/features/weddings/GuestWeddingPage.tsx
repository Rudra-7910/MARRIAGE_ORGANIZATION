import { api, apiMessage } from "../../lib/api";
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "../../components/ui/Icon";
import {
  directions,
  getGuestWedding,
  weddingBlessing,
  weddingDate,
  weddingTime,
  youtubePlayer,
} from "../../lib/weddings";
import { WeddingCountdown } from "./WeddingCountdown";
import { getPublicFunctions, planningTime } from "../../lib/planning";
import type { WeddingFunction } from "../../lib/planning";
import { getPublicAnnouncements } from "../../lib/site";
import type { Announcement } from "../../lib/site";
import { LanguageToggle } from "../integrations/LanguageToggle";
import { useTranslation } from "react-i18next";
import { PublicGallery } from "../media/PublicGallery";

export function GuestWeddingPage() {
  const { publicId = "" } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  // Keep the bearer link in the fragment, out of server logs and referrers.
  const invite = new URLSearchParams(location.hash.slice(1)).get("invite");
  const [copiedAddress, setCopiedAddress] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [playingVideo, setPlayingVideo] = useState("");
  const query = useQuery({
    queryKey: ["guest-wedding", publicId],
    queryFn: ({ signal }) => getGuestWedding(publicId, signal),
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const wedding = query.data;
  const publicFunctions = useQuery({
    queryKey: ["public-functions", publicId],
    queryFn: ({ signal }) => getPublicFunctions(publicId, signal),
    enabled: Boolean(wedding) && invite === null,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const personal = useQuery({
    queryKey: ["personal-invitation", publicId, invite],
    queryFn: async ({ signal }) =>
      (
        await api.post<{
          data: {
            name: string;
            side: string;
            functions: WeddingFunction[];
            announcements: Announcement[];
          };
        }>(
          "/public/weddings/" + encodeURIComponent(publicId) + "/invitation",
          { token: invite },
          { signal },
        )
      ).data.data,
    enabled: Boolean(wedding) && invite !== null,
    staleTime: 30000,
    refetchInterval: 30000,
    retry: false,
  });
  const publicUpdates = useQuery({
    queryKey: ["public-announcements", publicId],
    queryFn: ({ signal }) => getPublicAnnouncements(publicId, signal),
    enabled: Boolean(wedding) && invite === null,
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const functions =
    invite === null
      ? publicFunctions
      : {
          data: personal.isError ? undefined : personal.data?.functions,
          isError: personal.isError,
          refetch: personal.refetch,
        };
  const updates =
    invite === null
      ? publicUpdates.data
      : personal.isError
        ? undefined
        : personal.data?.announcements;
  if (query.isPending)
    return (
      <main className="celebration-status" role="status">
        <span lang="hi">शुभ विवाह</span>
        <h1>Loading wedding details…</h1>
      </main>
    );
  if (!wedding)
    return (
      <main className="celebration-status">
        <Icon name="mail" />
        <h1>Wedding invitation unavailable</h1>
        <p role="alert">{apiMessage(query.error)}</p>
        <button
          type="button"
          className="ws-button ws-primary"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </main>
    );

  const address = wedding.venue + ", " + wedding.address + ", " + wedding.city;
  const mapLink = directions(wedding);
  const phoneLink = "tel:" + wedding.phone.replace(/[^+\d]/g, "");
  const player = youtubePlayer(wedding.youtube);
  const monogram =
    wedding.brideName.slice(0, 1) + " & " + wedding.groomName.slice(0, 1);
  async function copyAddress() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
    } catch {
      setCopyFailed(true);
    }
  }
  return (
    <div
      className="celebration-guest"
      id="wedding-top"
      onClick={(event) => {
        if (invite === null || !(event.target instanceof Element)) return;
        const anchor = event.target.closest("a[href^='#']");
        if (!anchor) return;
        event.preventDefault();
        document
          .getElementById(anchor.getAttribute("href")!.slice(1))
          ?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      <a href="#guest-content" className="skip-link">
        Skip to wedding invitation
      </a>
      <header className="celebration-guest-nav">
        <a
          href="#wedding-top"
          className="celebration-monogram"
          aria-label="Back to wedding invitation"
        >
          {monogram}
        </a>
        <nav aria-label="Wedding information">
          <a href="#ceremony">{t("Our wedding")}</a>
          <a href="#venue">Venue</a>
          {Boolean(functions.data?.length) && (
            <a href="#guest-functions">Functions</a>
          )}
          {wedding.youtube && <a href="#ceremony-stream">Watch on YouTube</a>}
          <a href="#family-contact">{t("Contact organizer")}</a>
        </nav>
        <LanguageToggle />
        <span className="celebration-city">
          <Icon name="pin" />
          {wedding.city}
        </span>
      </header>
      {query.isError && (
        <div className="celebration-sync-notice" role="status">
          We couldn’t refresh the invitation. Showing the last saved details.
          <button type="button" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      )}
      <main id="guest-content">
        {personal.isError && (
          <div className="celebration-sync-notice" role="alert">
            This personal invitation is unavailable. Please contact the family
            for a current link. <a href="#family-contact">Contact organizer</a>
          </div>
        )}
        {personal.data && !personal.isError && (
          <p
            className={
              "guest-personal-welcome celebration-container side-" +
              personal.data.side.toLowerCase()
            }
          >
            {personal.data.name}, you’re invited to the following functions.
          </p>
        )}
        <section className="celebration-guest-hero">
          <div className="celebration-container guest-hero-layout">
            <div className="celebration-guest-intro">
              <p lang="hi" className="celebration-invocation">
                ॥ श्री गणेशाय नमः ॥
              </p>
              <h1>
                <span>
                  {wedding.brideName} <span className="guest-name-join">&</span>
                </span>
                <span>{wedding.groomName}</span>
              </h1>
              <p className="guest-family-invitation">
                Together with our families
              </p>
              <p className="celebration-guest-tagline" lang="hi">
                एक नई शुरुआत। आपके स्नेह और आशीर्वाद के साथ।
              </p>
              <div className="celebration-guest-date">
                <time dateTime={wedding.date}>{weddingDate(wedding.date)}</time>
                <p>
                  <Icon name="clock" />
                  <time
                    dateTime={
                      wedding.date + "T" + wedding.startTime + ":00+05:30"
                    }
                  >
                    {weddingTime(wedding.startTime)} IST
                  </time>
                </p>
                <span>Wedding ceremony / shubh muhurat</span>
              </div>
              <p className="celebration-guest-place">
                <Icon name="pin" />
                <span>
                  <strong>{wedding.venue}</strong>
                  {wedding.city}
                </span>
              </p>
              <div className="celebration-actions">
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-primary"
                >
                  <Icon name="pin" />
                  Get directions
                </a>
                <a href="#ceremony" className="button button-secondary">
                  Ceremony details <Icon name="chevron" />
                </a>
              </div>
            </div>
            <div className="guest-hero-visual">
              <img
                src="/images/celebration/invitation-details.webp"
                srcSet="/images/celebration/invitation-details-small.webp 720w, /images/celebration/invitation-details.webp 1400w"
                sizes="(min-width: 960px) 48vw, 100vw"
                width={1200}
                height={896}
                alt=""
                fetchPriority="high"
              />
              <WeddingCountdown
                date={wedding.date}
                time={wedding.startTime}
                detailsHref="#ceremony"
              />
            </div>
          </div>
        </section>
        <section className="celebration-welcome celebration-container">
          <div className="guest-welcome-heading">
            <h2 lang="hi">स्नेहिल आमंत्रण</h2>
            <p lang="hi">प्रिय परिजनों एवं मित्रों,</p>
          </div>
          <div className="guest-welcome-letter">
            <p lang={wedding.welcome ? undefined : "hi"}>
              {wedding.welcome || weddingBlessing}
            </p>
            <span className="celebration-signature">
              {wedding.brideName} & {wedding.groomName}
            </span>
          </div>
        </section>
        <section className="celebration-container" id="ceremony">
          <div className="celebration-ceremony-card">
            <div>
              <h2>The wedding ceremony</h2>
              <p className="guest-ceremony-blessing" lang="hi">
                ॥ शुभ विवाह ॥
              </p>
              <p lang="hi">
                आप सपरिवार पधारें, हमारी खुशियों में शामिल हों और नवजीवन के इस
                शुभ अवसर पर अपना आशीर्वाद दें।
              </p>
              <div className="celebration-ceremony-meta">
                <div>
                  <Icon name="calendar" />
                  <span>
                    <strong>
                      <time dateTime={wedding.date}>
                        {weddingDate(wedding.date)}
                      </time>
                    </strong>
                    Wedding date
                  </span>
                </div>
                <div>
                  <Icon name="clock" />
                  <span>
                    <strong>
                      {weddingTime(wedding.startTime)}
                      {wedding.endTime
                        ? " – " + weddingTime(wedding.endTime)
                        : ""}{" "}
                      IST
                    </strong>
                    Wedding ceremony / shubh muhurat
                  </span>
                </div>
              </div>
            </div>
            <div className="celebration-ceremony-location">
              <Icon name="pin" />
              <span>Venue</span>
              <h3>{wedding.venue}</h3>
              <p>
                {wedding.address}, {wedding.city}
              </p>
              <a className="ws-text-link" href="#venue">
                View destination details <Icon name="arrow" />
              </a>
            </div>
          </div>
        </section>
        {Boolean(functions.data?.length) && !functions.isError && (
          <section
            className="plan-public-functions celebration-container"
            id="guest-functions"
          >
            <h2>Wedding functions</h2>
            <div className="guest-function-timeline">
              {functions.data!.map((item) => (
                <article key={item.id} className="guest-function-row">
                  <div className="guest-function-timing">
                    <time dateTime={item.startsAt + ":00+05:30"}>
                      {planningTime(item.startsAt)}
                    </time>
                    <p>Until {planningTime(item.endsAt)}</p>
                  </div>
                  <div className="guest-function-details">
                    <h3>{item.name}</h3>
                    <p>
                      <Icon name="pin" />
                      {item.venue}
                    </p>
                    <p>
                      {item.address}, {item.city}
                    </p>
                  </div>
                  <a
                    className="ws-button"
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://www.google.com/maps/dir/?api=1&destination=" +
                      encodeURIComponent(item.address + ", " + item.city)
                    }
                  >
                    Get directions <Icon name="arrow" />
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
        {functions.isError && (
          <div className="celebration-sync-notice" role="status">
            We couldn’t load additional function timings.
            <button type="button" onClick={() => functions.refetch()}>
              Try again
            </button>
          </div>
        )}
        <section
          className="celebration-guest-venue celebration-container"
          id="venue"
        >
          <div className="celebration-section-heading">
            <h2>Venue & directions</h2>
          </div>
          <div className="celebration-venue-layout">
            <div className="celebration-venue-address">
              <h3>{wedding.venue}</h3>
              <p>
                {wedding.address}, {wedding.city}
              </p>
              {wedding.latitude !== null && wedding.longitude !== null && (
                <p className="celebration-coordinates">
                  {wedding.latitude}, {wedding.longitude}
                </p>
              )}
            </div>
            <div className="celebration-venue-info">
              <a
                className="button button-primary"
                href={mapLink}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="pin" />
                Open in Google Maps
              </a>
              <button
                type="button"
                className="button button-secondary"
                onClick={copyAddress}
              >
                <Icon name={copiedAddress === address ? "check" : "link"} />
                {copiedAddress === address ? "Address copied" : "Copy address"}
              </button>
              {copyFailed && (
                <p role="status">Please select and copy the address above.</p>
              )}
              <small>Google Maps will help you plan your route.</small>
            </div>
          </div>
        </section>
        {wedding.youtube && (
          <section
            id="ceremony-stream"
            className="celebration-stream celebration-container"
          >
            <div>
              <h2>Join us on YouTube</h2>
              <p>Watch the ceremony using the link shared by the family.</p>
              <a
                className="button"
                href={wedding.youtube}
                target="_blank"
                rel="noreferrer"
              >
                Watch on YouTube <Icon name="arrow" />
              </a>
            </div>
            {player && (
              <div className="celebration-stream-player">
                {playingVideo === player ? (
                  <iframe
                    className="ws-video"
                    title="Wedding ceremony on YouTube"
                    src={player}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayingVideo(player)}
                    aria-label="Load wedding ceremony YouTube player"
                  >
                    <span className="celebration-play-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        fill="currentColor"
                      >
                        <path d="m9 5 11 7-11 7Z" />
                      </svg>
                    </span>
                    <span>Watch the wedding ceremony</span>
                    <small>Play the ceremony on YouTube</small>
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        {Boolean(updates?.length) && (
          <section
            className="celebration-container guest-public-updates"
            aria-labelledby="guest-update-heading"
          >
            <h2 id="guest-update-heading">{t("Guest updates")}</h2>
            {updates!.map((item) => (
              <article key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <small>
                  Updated{" "}
                  {new Date(item.updatedAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST
                </small>
              </article>
            ))}
          </section>
        )}
        {publicUpdates.isError && invite === null && (
          <p className="celebration-sync-notice" role="status">
            Guest updates could not be refreshed.{" "}
            <button onClick={() => publicUpdates.refetch()}>Try again</button>
          </p>
        )}
        <PublicGallery publicId={publicId} />
        <section
          id="family-contact"
          className="celebration-family-contact celebration-container"
        >
          <div>
            <h2>Contact the family</h2>
            <p>Call the coordinator for directions or ceremony questions.</p>
          </div>
          <div className="celebration-contact-card">
            <span className="celebration-contact-icon">
              <Icon name="phone" />
            </span>
            <h3>{wedding.contactRole}</h3>
            <a className="celebration-contact-number" href={phoneLink}>
              {wedding.phone}
            </a>
            <a className="button button-primary" href={phoneLink}>
              <Icon name="phone" />
              Call family coordinator
            </a>
          </div>
        </section>
        <footer className="celebration-guest-footer">
          <span className="celebration-footer-monogram">{monogram}</span>
          <h2 lang="hi">आपका इंतज़ार रहेगा।</h2>
          <p>
            {wedding.brideName} & {wedding.groomName}
          </p>
          <span>Wedding website by Make My Marriage</span>
        </footer>
      </main>
      <nav
        className="celebration-mobile-actions"
        aria-label="Quick guest actions"
      >
        <a href={mapLink} target="_blank" rel="noreferrer">
          <Icon name="pin" />
          Directions
        </a>
        <a href={phoneLink}>
          <Icon name="phone" />
          Call family
        </a>
      </nav>
    </div>
  );
}
