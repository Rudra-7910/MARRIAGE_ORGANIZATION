import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { SiteHeader } from "../components/layout/SiteHeader";
import { SiteFooter } from "../components/layout/SiteFooter";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";
import { SetupDiagram } from "../features/weddings/SetupPage";
import { PlanningComparison } from "../features/home/components/PlanningComparison";
import { FeatureSection } from "../features/home/components/FeatureSection";
import { HowItWorks } from "../features/home/components/HowItWorks";
import { FaqSection } from "../features/home/components/FaqSection";

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
        <PlanningComparison />
        <FeatureSection />
        <HowItWorks />
        <FaqSection />
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
