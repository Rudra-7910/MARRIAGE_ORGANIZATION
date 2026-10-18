import { Icon } from "../../../components/ui/Icon";
import { features } from "../data/home-content";

export function FeatureSection() {
  return (
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
            <br className="desktop-break" /> keeping track and more time being
            there.
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
  );
}
