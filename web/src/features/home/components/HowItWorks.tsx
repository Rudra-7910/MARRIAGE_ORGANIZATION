import { Icon } from "../../../components/ui/Icon";
import { steps } from "../data/home-content";

export function HowItWorks() {
  return (
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
  );
}
