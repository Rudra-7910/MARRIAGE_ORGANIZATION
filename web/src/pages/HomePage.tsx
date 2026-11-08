import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/layout/SiteHeader";
import { SiteFooter } from "../components/layout/SiteFooter";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";

const questions = [
  {
    question: "Do our guests need an account?",
    answer:
      "No. Guests open your wedding link for the date, venue, directions, family contact and optional YouTube livestream. No registration or RSVP is needed.",
  },
  {
    question: "Can I edit the wedding later?",
    answer:
      "Yes. Update your saved wedding details in your organizer workspace. Your guest website will pick up those changes; the website link stays the same.",
  },
  {
    question: "How are invitations sent?",
    answer:
      "Save a guest or family with an email address, add a personal note, review the invitation, and send it individually. Guests can open your wedding website straight from the email.",
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [dialogTopic, setDialogTopic] = useState<DialogTopic | null>(null);
  const [family, setFamily] = useState("Gupta Parivar");
  const [note, setNote] = useState(
    "आपके स्नेह और आशीर्वाद से ही हमारा यह शुभ अवसर पूर्ण होगा। सपरिवार पधारकर हमारी खुशियों में शामिल हों।",
  );
  return (
    <div className="celebration-home" id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader onStart={() => navigate("/signup")} />
      <main id="main-content">
        <section className="celebration-home-hero celebration-container">
          <div className="celebration-hero-copy">
            <h1>
              Your wedding,
              <br />
              <span>one shared plan.</span>
            </h1>
            <p>
              Keep track of ceremonies, vendors and expenses. Give both
              families the same updates, and guests the details they need.
            </p>
            <div className="celebration-actions">
              <Link to="/signup" className="button button-primary">
                Create wedding workspace <Icon name="arrow" />
              </Link>
              <a href="#features" className="button button-secondary">
                See how it works <Icon name="chevron" />
              </a>
            </div>
            <div className="celebration-reassurance">
              <span>
                <Icon name="lock" />
                Private organizer workspace
              </span>
              <span>
                <Icon name="people" />
                Made for both families
              </span>
            </div>
          </div>
          <div className="celebration-hero-visual">
            <img
              src="/images/celebration/wedding-joy.webp"
              srcSet="/images/celebration/wedding-joy-small.webp 720w, /images/celebration/wedding-joy.webp 1400w"
              sizes="(max-width: 850px) 90vw, 48vw"
              width={1400}
              height={780}
              alt="A joyful Indian wedding celebration beneath marigold garlands"
              fetchPriority="high"
            />
            <ProductPreview />
          </div>
        </section>

        <section
          id="how-it-works"
          className="celebration-section celebration-container"
        >
          <div className="celebration-section-heading">
            <h2>Start with your family and wedding details.</h2>
            <p>
              Set up once, then invite the family members and helpers who will
              be planning with you.
            </p>
          </div>
          <ol className="celebration-steps">
            {[
              {
                title: "Create your account",
                body: "Sign up as a couple, family member or planner.",
                icon: "lock" as const,
              },
              {
                title: "Add your family",
                body: "Enter your family name and choose the bride’s side, groom’s side or both.",
                icon: "people" as const,
              },
              {
                title: "Set up your wedding",
                body: "Add the couple’s names, date, shubh muhurat, venue and family contact.",
                icon: "calendar" as const,
              },
            ].map((step, index) => (
              <li key={step.title}>
                <span className="celebration-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <Icon name={step.icon} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="features"
          className="celebration-story celebration-container"
        >
          <div className="celebration-story-copy">
            <h2>
              A personal invitation
              <br />
              <span>for every family.</span>
            </h2>
            <p>
              Save a family’s email address, add a note and preview the
              invitation before sending it.
            </p>
            <div className="celebration-note-editor">
              <span className="celebration-sample">
                Sample invitation. This preview does not send email.
              </span>
              <label>
                Guest / family name
                <input
                  maxLength={120}
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                />
              </label>
              <label>
                Your personal note
                <textarea
                  lang="hi"
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <Link to="/signup" className="ws-text-link">
                Create an invitation <Icon name="arrow" />
              </Link>
            </div>
          </div>
          <div className="celebration-invite-visual">
            <img
              src="/images/celebration/invitation-details.webp"
              srcSet="/images/celebration/invitation-details-small.webp 720w, /images/celebration/invitation-details.webp 1400w"
              sizes="(max-width: 850px) 90vw, 45vw"
              alt="Marigolds and a brass diya beside a wedding invitation"
              width={1400}
              height={1044}
              loading="lazy"
              decoding="async"
            />
            <div
              className="celebration-paper"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="celebration-invocation" lang="hi">
                ॥ श्री गणेशाय नमः ॥
              </p>
              <h3>{family.trim() || "Guest / family name"}</h3>
              <p lang="hi">{note || "Your personal note will appear here."}</p>
            </div>
          </div>
        </section>

        <section
          id="for-guests"
          className="celebration-story celebration-story-reverse celebration-container"
        >
          <div className="celebration-venue-visual">
            <img
              src="/images/celebration/wedding-courtyard.webp"
              srcSet="/images/celebration/wedding-courtyard-small.webp 720w, /images/celebration/wedding-courtyard.webp 1400w"
              sizes="(max-width: 850px) 90vw, 48vw"
              alt="A warmly lit Indian wedding courtyard, shown as celebration inspiration"
              width={1400}
              height={780}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="celebration-story-copy">
            <h2>
              The date. The venue.
              <br />
              <span>One link for guests.</span>
            </h2>
            <p>
              Your date, directions and family contact. No guest registration
              needed.
            </p>
            <div className="celebration-benefit">
              <Icon name="pin" />
              <div>
                <h3>Directions to the venue</h3>
                <p>Google Maps directions from your saved wedding location.</p>
              </div>
            </div>
            <div className="celebration-benefit">
              <Icon name="globe" />
              <div>
                <h3>Watch on YouTube</h3>
                <p>
                  Add a ceremony livestream link for guests joining from home.
                </p>
              </div>
            </div>
            <Link to="/signup" className="ws-text-link">
              Set up your guest website <Icon name="arrow" />
            </Link>
          </div>
        </section>

        <section className="celebration-privacy celebration-container">
          <Icon name="lock" />
          <h2>Give each person the access they need.</h2>
          <p>
            Organizers manage expenses and invitations. Helpers see their work
            and department progress. Guests see ceremony details and approved
            photos, without an account.
          </p>
        </section>
        <section
          id="questions"
          className="celebration-section celebration-container"
        >
          <div className="celebration-section-heading">
            <h2>Before you start</h2>
          </div>
          <div className="celebration-faq">
            {questions.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <Icon name="plus" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="celebration-closing celebration-container">
          <h2>Start planning your wedding.</h2>
          <p>
            Add your family, set the date and invite your planning team.
          </p>
          <Link to="/signup" className="button">
            Create your wedding workspace <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <SiteFooter onInfo={setDialogTopic} />
      <InfoDialog topic={dialogTopic} onClose={() => setDialogTopic(null)} />
    </div>
  );
}

function ProductPreview() {
  const tabs = ["Planning", "Invitations", "Guest website"];
  const [tab, setTab] = useState(0);
  return (
    <div className="celebration-product-preview">
      <div className="celebration-preview-title">
        <strong>The wedding workspace</strong>
        <span>Feature preview</span>
      </div>
      <div role="tablist" aria-label="Preview wedding features">
        {tabs.map((name, index) => (
          <button
            key={name}
            id={"experience-tab-" + index}
            role="tab"
            type="button"
            aria-selected={tab === index}
            aria-controls="experience-panel"
            tabIndex={tab === index ? 0 : -1}
            onClick={() => setTab(index)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              setTab(next);
              document.getElementById("experience-tab-" + next)?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="experience-panel"
        aria-labelledby={"experience-tab-" + tab}
      >
        {tab === 0 && (
          <>
            <Icon name="calendar" />
            <div>
              <strong>See which departments need attention.</strong>
              <p>Track tasks, progress updates and pending expenses.</p>
            </div>
          </>
        )}
        {tab === 1 && (
          <>
            <Icon name="mail" />
            <div>
              <strong lang="hi">आपकी उपस्थिति सादर प्रार्थनीय है।</strong>
              <p>Review the email, then send one family at a time.</p>
            </div>
          </>
        )}
        {tab === 2 && (
          <>
            <Icon name="pin" />
            <div>
              <strong>Date, directions and a number to call.</strong>
              <p>Guests open your wedding link without signing up.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
