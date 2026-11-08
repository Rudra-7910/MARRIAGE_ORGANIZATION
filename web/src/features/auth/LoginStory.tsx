import { Icon } from "../../components/ui/Icon";
import type { IconName } from "../../components/ui/Icon";

const benefits: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "calendar",
    title: "Functions and venues",
    description: "Keep Mehendi, Sangeet and reception details up to date.",
  },
  {
    icon: "people",
    title: "Department progress",
    description: "See what’s done and which teams need your attention.",
  },
  {
    icon: "wallet",
    title: "Expenses stay private",
    description: "Only organizers can view service costs and pending dues.",
  },
];

export function LoginStory() {
  return (
    <aside className="login-story" aria-label="Wedding planning features">
      <figure className="login-story-photo">
        <img
          src="/images/stitch/ceremony-1.jpg"
          alt="A wedding ceremony surrounded by loved ones"
          width="640"
          height="420"
        />
      </figure>
      <div className="login-story-copy">
        <h2>Your wedding workspace</h2>
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
            <h3>Invited as a guest?</h3>
            <p>
              Guests don’t need an account. Just open the invitation link shared
              with you.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
