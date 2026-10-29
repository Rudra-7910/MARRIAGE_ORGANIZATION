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
            <span className="celebration-kicker">
              <Icon name="spark" /> FOR YOUR PEOPLE. FOR YOUR BIG DAY.
            </span>
            <h1>
              Shaadi ke pal,
              <br />
              <em>saath sambhaalein.</em>
            </h1>
            <p>
              One shared wedding workspace for both families. Your plans,
              invitations and celebration, beautifully together.
            </p>
            <div className="celebration-actions">
              <Link to="/signup" className="button button-primary">
                Create wedding workspace <Icon name="arrow" />
              </Link>
              <a href="#features" className="button button-secondary">
                Explore the experience <Icon name="chevron" />
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
            <span className="celebration-kicker">THOUGHTFUL SIMPLICITY</span>
            <h2>
              A little setup.
              <br />
              <em>A beautiful beginning.</em>
            </h2>
            <p>Start with your people. Make the rest feel a little easier.</p>
          </div>
          <div className="celebration-steps">
            {[
              {
                title: "Create your account",
                body: "A private place to bring your wedding plans together.",
                icon: "lock" as const,
              },
              {
                title: "Add your family",
                body: "Give your family a shared starting point, whichever side you’re from.",
                icon: "people" as const,
              },
              {
                title: "Set up your wedding",
                body: "Save the names, shubh muhurat, venue and a warm welcome for your guests.",
                icon: "calendar" as const,
              },
            ].map((step, index) => (
              <article key={step.title}>
                <span className="celebration-step-number">0{index + 1}</span>
                <Icon name={step.icon} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="features"
          className="celebration-story celebration-container"
        >
          <div className="celebration-story-copy">
            <span className="celebration-kicker">
              <Icon name="mail" /> A LITTLE LOVE, IN THEIR INBOX
            </span>
            <h2>
              A personal invitation
              <br />
              <em>for every family.</em>
            </h2>
            <p>
              Some invitations deserve more than a forwarded message. Add your
              own words, preview the details, and invite one guest or family at
              a time.
            </p>
            <div className="celebration-note-editor">
              <span className="celebration-sample">
                TRY AN ILLUSTRATIVE PREVIEW · NOTHING IS SENT
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
                Make it your own <Icon name="arrow" />
              </Link>
            </div>
          </div>
          <div className="celebration-invite-visual">
            <img
              src="/images/celebration/invitation-details.webp"
              srcSet="/images/celebration/invitation-details-small.webp 720w, /images/celebration/invitation-details.webp 1400w"
              sizes="(max-width: 850px) 90vw, 45vw"
              alt="Marigolds, a brass diya and a thoughtfully prepared wedding invitation"
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
              <span className="celebration-kicker">A SNEH-BHARA NIMANTRAN</span>
              <h3>{family.trim() || "Your loved ones"}</h3>
              <p lang="hi">{note || "Your personal note will appear here."}</p>
              <span className="celebration-paper-footer">
                Your names. Your wedding. Their blessings.
              </span>
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
            <span>For the people near. And the people far.</span>
          </div>
          <div className="celebration-story-copy">
            <span className="celebration-kicker">
              ONE LINK. A WARM WELCOME.
            </span>
            <h2>
              Easy to find.
              <br />
              <em>Lovely to be part of.</em>
            </h2>
            <p>
              A wedding website that feels like your celebration. Guests find
              the date, venue and family contact without another app or account.
            </p>
            <div className="celebration-benefit">
              <Icon name="pin" />
              <div>
                <h3>“Kahan pahunchna hai?” Sorted.</h3>
                <p>Google Maps directions from your saved wedding location.</p>
              </div>
            </div>
            <div className="celebration-benefit">
              <Icon name="globe" />
              <div>
                <h3>Celebrate from wherever you are.</h3>
                <p>
                  Add your YouTube ceremony link for loved ones who can’t make
                  it.
                </p>
              </div>
            </div>
            <Link to="/signup" className="ws-text-link">
              Create your wedding’s home <Icon name="arrow" />
            </Link>
          </div>
        </section>

        <section className="celebration-privacy celebration-container">
          <Icon name="lock" />
          <h2>
            Your planning stays private.
            <br />
            <em>Your celebration is easy to share.</em>
          </h2>
          <p>
            Your organizer workspace and guest website have separate access.
            Your public page shares only the wedding details meant for your
            guests.
          </p>
        </section>
        <section
          id="questions"
          className="celebration-section celebration-container"
        >
          <div className="celebration-section-heading">
            <span className="celebration-kicker">A FEW GOOD QUESTIONS</span>
            <h2>
              Simple answers.
              <br />
              <em>More peace of mind.</em>
            </h2>
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
          <span className="celebration-kicker">A LITTLE MORE TOGETHER</span>
          <h2>
            Make room for the moments
            <br />
            <em>that matter.</em>
          </h2>
          <p>
            The happy tears. The family jokes. The people you love.
            <br />
            Let the planning bring you closer.
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
  const tabs = ["Organize", "Invite", "Celebrate"];
  const [tab, setTab] = useState(0);
  return (
    <div className="celebration-product-preview">
      <div className="celebration-preview-title">
        <strong>
          <Icon name="spark" />
          Your celebration, together
        </strong>
        <span>Illustrative preview</span>
      </div>
      <div role="tablist" aria-label="Explore the wedding experience">
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
              <span>YOUR WEDDING, AT A GLANCE</span>
              <strong>Your date. Your venue. Your people.</strong>
              <p>Saved details, one shared starting point.</p>
            </div>
          </>
        )}
        {tab === 1 && (
          <>
            <Icon name="mail" />
            <div>
              <span>A PERSONAL FAMILY INVITATION</span>
              <strong lang="hi">आपकी उपस्थिति सादर प्रार्थनीय है।</strong>
              <p>Preview your note, then send one family at a time.</p>
            </div>
          </>
        )}
        {tab === 2 && (
          <>
            <Icon name="pin" />
            <div>
              <span>A WARM WELCOME FOR YOUR GUESTS</span>
              <strong>Directions. A little help. All the love.</strong>
              <p>One wedding link, no guest sign-up.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
