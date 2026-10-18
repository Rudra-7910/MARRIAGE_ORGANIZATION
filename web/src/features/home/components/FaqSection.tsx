import { Icon } from "../../../components/ui/Icon";
import { questions } from "../data/home-content";

export function FaqSection() {
  return (
    <section id="questions" className="section-spacing faq-section">
      <div className="page-container">
        <div className="section-heading">
          <span className="eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</span>
          <h2>
            Good questions.
            <br className="mobile-break" /> <em>Simple answers.</em>
          </h2>
          <p>Because wedding planning already comes with enough questions.</p>
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
  );
}
