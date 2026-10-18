import { Icon } from "../../../components/ui/Icon";
import type { IconName } from "../../../components/ui/Icon";

const benefits: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "calendar",
    title: "One shared plan.",
    description:
      "From Mehendi to the reception, keep your dates, venues and family in sync.",
  },
  {
    icon: "people",
    title: "Everyone in the loop.",
    description:
      "Family, helpers and service updates. A little less calling, a lot more clarity.",
  },
  {
    icon: "wallet",
    title: "Expenses, kept private.",
    description:
      "Know what’s paid and what’s pending. Financial details stay with wedding organizers.",
  },
];

export function LoginStory() {
  return (
    <aside className="login-story" aria-label="A calmer way to plan together">
      <span className="login-story-flower" aria-hidden="true">
        ✳
      </span>
      <span className="login-story-eyebrow">
        <span className="status-dot" />
        MADE FOR BOTH FAMILIES
      </span>
      <h2>
        Plan together.
        <br />
        <em>Follow up less.</em>
      </h2>
      <p className="login-story-intro">
        For the big day, the little details,
        <br />
        and everyone who makes it happen.
      </p>
      <div className="login-benefits">
        {benefits.map((benefit) => (
          <div className="login-benefit" key={benefit.title}>
            <span className="login-benefit-icon">
              <Icon name={benefit.icon} />
            </span>
            <div>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="login-guest-note">
        <span>
          <Icon name="link" />
        </span>
        <div>
          <h3>Here to celebrate?</h3>
          <p>
            Guests don’t need an account. Just open the invitation link shared
            with you.
          </p>
        </div>
      </div>
    </aside>
  );
}
