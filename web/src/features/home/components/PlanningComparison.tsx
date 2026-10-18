import { Icon } from "../../../components/ui/Icon";

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

export function PlanningComparison() {
  return (
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
                <span className="card-eyebrow">THE MAKE MY MARRIAGE WAY</span>
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
  );
}
