import { apiMessage } from "../../lib/api";
import { useState } from "react";
import { useParams } from "react-router-dom";
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

export function GuestWeddingPage() {
  const { publicId = "" } = useParams();
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
  if (query.isPending)
    return (
      <main className="celebration-status" role="status">
        <span lang="hi">शुभ विवाह</span>
        <h1>A beautiful celebration awaits.</h1>
        <p>Opening your wedding invitation…</p>
      </main>
    );
  if (!wedding)
    return (
      <main className="celebration-status">
        <Icon name="mail" />
        <h1>Wedding invitation unavailable</h1>
        <p role="alert">{apiMessage(query.error)}</p>
        <button
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
    <div className="celebration-guest" id="wedding-top">
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
          <a href="#ceremony">The wedding</a>
          <a href="#venue">Venue</a>
          {wedding.youtube && <a href="#ceremony-stream">Watch on YouTube</a>}
          <a href="#family-contact">Contact</a>
        </nav>
        <span className="celebration-city">
          <Icon name="pin" />
          {wedding.city}
        </span>
      </header>
      {query.isError && (
        <div className="celebration-sync-notice" role="status">
          We couldn’t refresh the invitation. Showing the last saved details.
          <button onClick={() => query.refetch()}>Try again</button>
        </div>
      )}
      <main id="guest-content">
        <section className="celebration-guest-hero">
          <img
            src="/images/celebration/invitation-details.webp"
            srcSet="/images/celebration/invitation-details-small.webp 720w, /images/celebration/invitation-details.webp 1400w"
            sizes="100vw"
            width={1200}
            height={896}
            alt=""
            fetchPriority="high"
          />
          <div className="celebration-container">
            <div className="celebration-guest-intro">
              <p lang="hi" className="celebration-invocation">
                ॥ श्री गणेशाय नमः ॥
              </p>
              <span className="celebration-kicker">
                TOGETHER WITH OUR FAMILIES
              </span>
              <h1>
                {wedding.brideName}
                <em>&</em>
                {wedding.groomName}
              </h1>
              <p className="celebration-guest-tagline" lang="hi">
                एक नई शुरुआत। आपके स्नेह और आशीर्वाद के साथ।
              </p>
              <div className="celebration-guest-date">
                <span className="celebration-kicker">THE WEDDING DAY</span>
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
                  <span>Wedding ceremony</span>
                </p>
              </div>
              <p className="celebration-guest-place">
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
              detailsHref="#ceremony"
            />
            <div className="celebration-actions">
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="button"
              >
                <Icon name="pin" />
                Get directions
              </a>
              <a href="#ceremony" className="button celebration-ghost">
                Explore the celebration <Icon name="chevron" />
              </a>
            </div>
          </div>
        </section>
        <section className="celebration-welcome celebration-container">
          <span className="celebration-flourish" aria-hidden="true">
            ✳
          </span>
          <span className="celebration-kicker" lang="hi">
            स्नेहिल आमंत्रण
          </span>
          <h2 lang="hi">प्रिय परिजनों एवं मित्रों,</h2>
          <p lang={wedding.welcome ? undefined : "hi"}>
            {wedding.welcome || weddingBlessing}
          </p>
          <span className="celebration-signature">
            {wedding.brideName} & {wedding.groomName}
          </span>
        </section>
        <section className="celebration-container" id="ceremony">
          <div className="celebration-ceremony-card">
            <div>
              <span className="celebration-kicker" lang="hi">
                ॥ शुभ विवाह ॥
              </span>
              <h2>The wedding ceremony</h2>
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
                    Our day of celebration
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
              <span>THE PLACE WE COME TOGETHER</span>
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
        <section
          className="celebration-guest-venue celebration-container"
          id="venue"
        >
          <div className="celebration-section-heading">
            <span className="celebration-kicker">WE CAN’T WAIT TO SEE YOU</span>
            <h2>Venue & directions</h2>
            <p>
              {wedding.venue} · {wedding.city}
            </p>
          </div>
          <div className="celebration-map-layout">
            <div className="celebration-map-art" aria-hidden="true">
              <span className="celebration-map-line line-one" />
              <span className="celebration-map-line line-two" />
              <span className="celebration-map-line line-three" />
              <div className="celebration-map-marker">
                <Icon name="pin" />
              </div>
              <strong>{wedding.city}</strong>
              <span>Your celebration, right here.</span>
            </div>
            <div className="celebration-venue-info">
              <span className="celebration-kicker">
                <Icon name="pin" />
                ADDRESS & LOCATION
              </span>
              <h3>{wedding.venue}</h3>
              <p>
                {wedding.address}, {wedding.city}
              </p>
              {wedding.latitude !== null && wedding.longitude !== null && (
                <p className="celebration-coordinates">
                  {wedding.latitude}, {wedding.longitude}
                </p>
              )}
              <a
                className="button button-primary"
                href={mapLink}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="pin" />
                Open in Google Maps
              </a>
              <button className="button button-secondary" onClick={copyAddress}>
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
              <span className="celebration-kicker">
                <Icon name="globe" />
                WITH LOVE, FROM WHEREVER YOU ARE
              </span>
              <h2>
                Celebrate with us,
                <br />
                <em>wherever you are.</em>
              </h2>
              <p>
                For the people who can’t be here in person, you’re still a part
                of our celebration.
              </p>
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
                    onClick={() => setPlayingVideo(player)}
                    aria-label="Load wedding ceremony YouTube player"
                  >
                    <span className="celebration-play-icon">▶</span>
                    <span>Be a part of the moment</span>
                    <small>Play the ceremony on YouTube</small>
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        <section
          id="family-contact"
          className="celebration-family-contact celebration-container"
        >
          <span className="celebration-kicker">
            A FAMILIAR VOICE, A LITTLE HELP
          </span>
          <h2>We’re here for you.</h2>
          <p>For directions or a little help on the wedding day.</p>
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
          <span>Made with love · Make My Marriage</span>
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
