import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Brand } from "../../components/ui/Brand";
import {
  apiMessage,
  directions,
  getGuestWedding,
  weddingDate,
  youtubePlayer,
} from "../../lib/weddings";

export function GuestWeddingPage() {
  const { publicId = "" } = useParams();
  const query = useQuery({
    queryKey: ["guest-wedding", publicId],
    queryFn: () => getGuestWedding(publicId),
    staleTime: 0,
    refetchInterval: 5000,
  });
  const wedding = query.data;
  return (
    <div className="live-guest-page">
      <header className="setup-header">
        <Brand />
        <Link className="ws-text-link" to="/login">
          Organizer login
        </Link>
      </header>
      {query.isPending ? (
        <main className="ws-empty" role="status">
          Opening the wedding website…
        </main>
      ) : query.isError || !wedding ? (
        <main className="ws-empty">
          <h1>Wedding website unavailable</h1>
          <p role="alert">{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Try again
          </button>
        </main>
      ) : (
        <main>
          <section className="live-guest-hero">
            <span className="ws-eyebrow">TOGETHER WITH THEIR FAMILIES</span>
            <h1>
              {wedding.brideName}
              <em>&</em>
              {wedding.groomName}
            </h1>
            <p>
              {weddingDate(wedding.date)} · {wedding.city}
            </p>
            <span>You’re warmly invited</span>
          </section>
          <section className="live-guest-body">
            {wedding.welcome && (
              <p className="live-welcome">{wedding.welcome}</p>
            )}
            <section className="ws-panel">
              <div className="ws-panel-heading">
                <h2>Come celebrate with us</h2>
              </div>
              <dl className="wedding-details">
                <div>
                  <dt>Date</dt>
                  <dd>{weddingDate(wedding.date)}</dd>
                </div>
                <div>
                  <dt>Ceremony time (IST)</dt>
                  <dd>
                    {wedding.startTime}
                    {wedding.endTime ? " – " + wedding.endTime : ""}
                  </dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>{wedding.venue}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>
                    {wedding.address}, {wedding.city}
                  </dd>
                </div>
              </dl>
              <a
                href={directions(wedding)}
                className="ws-panel-link"
                target="_blank"
                rel="noreferrer"
              >
                Get directions in Google Maps ↗
              </a>
            </section>
            {youtubePlayer(wedding.youtube) && (
              <section className="live-stream">
                <h2>Join us from wherever you are</h2>
                <iframe
                  className="ws-video"
                  title="Wedding livestream on YouTube"
                  src={youtubePlayer(wedding.youtube)}
                  allowFullScreen
                />
              </section>
            )}
            <section className="live-contact">
              <h2>Need a little help?</h2>
              <p>{wedding.contactRole}</p>
              <a className="ws-button ws-primary" href={"tel:" + wedding.phone}>
                Call {wedding.phone}
              </a>
            </section>
          </section>
        </main>
      )}
      <footer className="live-guest-footer">
        Make My Marriage · A little more together.
      </footer>
    </div>
  );
}
