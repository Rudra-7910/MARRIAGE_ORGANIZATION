import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SiteHeader } from "../components/layout/SiteHeader";
import { SiteFooter } from "../components/layout/SiteFooter";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";
import { SetupDiagram } from "../features/weddings/SetupPage";
import { features, steps, questions } from "../features/home/data/home-content";

const before = [
  "The same update, asked in five different calls.",
  "Vendor details somewhere in the family group.",
  "“I thought someone else was handling it.”",
];
const after = [
  "One clear view of every department’s progress.",
  "Contacts, notes and updates right where you need them.",
  "Both families in the loop. Fewer loose ends.",
];

export function HomePage() {
  const navigate = useNavigate();
  const [dialogTopic, setDialogTopic] = useState<DialogTopic | null>(null);

  function startPlanning() {
    navigate("/signup");
  }

  return (
    <div id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader onStart={startPlanning} />
      <main id="main-content">
        <section className="hero-section">
          <div className="page-container">
            <div className="hero-copy">
              <span className="hero-eyebrow">
                <span className="little-flower" aria-hidden="true">
                  ✳
                </span>
                BIG CELEBRATIONS. A LITTLE LESS CHAOS.
              </span>
              <h1>
                Shaadi ki planning.
                <br />
                <em>Sab ek jagah.</em>
              </h1>
              <p>
                One shared place for your family, your services,
                <br className="desktop-break" /> and all the little things that
                make your big day.
              </p>
              <div className="hero-actions">
                <button
                  className="button button-primary"
                  onClick={startPlanning}
                >
                  Create your wedding workspace
                  <Icon name="arrow" />
                </button>
                <Link to="/login" className="button button-secondary">
                  <Icon name="eye" />
                  Open your workspace
                </Link>
              </div>
              <div className="hero-reassurance">
                <span>
                  <Icon name="people" />
                  Made for both families
                </span>
                <span className="reassurance-divider" />
                <span>
                  <Icon name="link" />
                  Guests join without signing up
                </span>
              </div>
            </div>
            <div className="home-setup-diagram">
              <SetupDiagram />
            </div>
            <div className="hero-afterword">
              <span className="handwritten-line" />
              <span>From the first family meeting to the last goodbye.</span>
              <span className="handwritten-line" />
            </div>
          </div>
        </section>
        {/* Planning comparison */}
        <section className="section-spacing comparison-section">
          <div className="page-container">
            <div className="section-heading">
              <span className="eyebrow">SOUND FAMILIAR?</span>
              <h2>
                “Caterer ko call kiya?”
                <br />
                <em>“Lighting ka update mila?”</em>
              </h2>
              <p>Your wedding deserves better than another follow-up call.</p>
            </div>
            <div className="comparison-grid">
              <article className="comparison-card before-card">
                <div className="comparison-title">
                  <span className="comparison-symbol">
                    <Icon name="message" />
                  </span>
                  <div>
                    <span className="card-eyebrow">THE USUAL WAY</span>
                    <h3>A hundred conversations.</h3>
                  </div>
                </div>
                <ul>
                  {before.map((item) => (
                    <li key={item}>
                      <span className="list-dash">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="comparison-footnote">
                  Lots of love. A little too much back-and-forth.
                </div>
              </article>
              <article className="comparison-card after-card">
                <div className="comparison-title">
                  <span className="comparison-symbol">
                    <Icon name="circle-check" />
                  </span>
                  <div>
                    <span className="card-eyebrow">
                      THE MAKE MY MARRIAGE WAY
                    </span>
                    <h3>One calmer place.</h3>
                  </div>
                </div>
                <ul>
                  {after.map((item) => (
                    <li key={item}>
                      <Icon name="check" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="comparison-footnote">
                  <Icon name="spark" />
                  Everyone together. Everything a little clearer.
                </div>
              </article>
            </div>
          </div>
        </section>
        {/* Features */}
        <section id="features" className="section-spacing features-section">
          <div className="page-container">
            <div className="section-heading">
              <span className="eyebrow">A PLACE FOR EVERY MOVING PART</span>
              <h2>
                Big Indian wedding.
                <br />
                <em>Surprisingly simple planning.</em>
              </h2>
              <p>
                The important things, together. So you can spend less time
                <br className="desktop-break" /> keeping track and more time
                being there.
              </p>
            </div>
            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.number}>
                  <div className="feature-card-top">
                    <span className="feature-icon">
                      <Icon name={feature.icon} />
                    </span>
                    <span className="feature-number">{feature.number}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <div className="feature-detail">
                    <span className="tiny-line" />
                    {feature.detail}
                  </div>
                </article>
              ))}
            </div>
            <div className="services-note">
              <span className="services-icon">
                <Icon name="pin" />
              </span>
              <p>
                Still looking for your wedding team?
                <span>
                  Discover nearby caterers, photographers and more. Connect with
                  them directly.
                </span>
              </p>
              <a href="#questions">
                A little more clarity
                <Icon name="arrow" />
              </a>
            </div>
          </div>
        </section>
        {/* How it works */}
        <section id="how-it-works" className="section-spacing steps-section">
          <div className="page-container">
            <div className="section-heading">
              <span className="eyebrow">LESS SETUP. MORE SHAADI.</span>
              <h2>
                A shared plan,
                <br className="mobile-break" /> <em>in three simple steps.</em>
              </h2>
              <p>No complicated systems. Just your people, on the same page.</p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <span className="step-detail">
                    <Icon name={step.icon} />
                    {step.detail}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
        {/* Frequently asked questions */}
        <section id="questions" className="section-spacing faq-section">
          <div className="page-container">
            <div className="section-heading">
              <span className="eyebrow">
                A FEW THINGS YOU MIGHT BE WONDERING
              </span>
              <h2>
                Good questions.
                <br className="mobile-break" /> <em>Simple answers.</em>
              </h2>
              <p>
                Because wedding planning already comes with enough questions.
              </p>
            </div>
            <div className="faq-list">
              {questions.map((item, index) => (
                <details
                  className="faq-item"
                  key={item.question}
                  open={index === 0}
                >
                  <summary>
                    <span>{item.question}</span>
                    <Icon name="plus" />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="closing-section">
          <div className="page-container">
            <div className="closing-card">
              <span className="closing-spark spark-left" aria-hidden="true">
                ✳
              </span>
              <span className="closing-spark spark-right" aria-hidden="true">
                ✳
              </span>
              <span className="eyebrow">
                BE THERE FOR THE MOMENTS THAT MATTER
              </span>
              <h2>
                Less follow-up.
                <br />
                <em>More celebration.</em>
              </h2>
              <p>
                The dance rehearsals. The family jokes. The happy tears.
                <br className="desktop-break" />
                Make a little more room for all of it.
              </p>
              <div className="hero-actions">
                <button
                  className="button button-primary"
                  onClick={startPlanning}
                >
                  Let’s plan your wedding
                  <Icon name="arrow" />
                </button>
                <Link to="/login" className="closing-demo">
                  Open your workspace
                  <Icon name="arrow" />
                </Link>
              </div>
              <span className="closing-note">
                Your people. Your plans. One happy place.
              </span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter onInfo={setDialogTopic} />
      <InfoDialog topic={dialogTopic} onClose={() => setDialogTopic(null)} />
    </div>
  );
}
