import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";
import { LoginForm } from "../features/auth/components/LoginForm";
import { LoginStory } from "../features/auth/components/LoginStory";

export function LoginPage() {
  const [dialogTopic, setDialogTopic] = useState<DialogTopic | null>(null);

  return (
    <div className="login-page">
      <a href="#login-main" className="skip-link">
        Skip to login
      </a>
      <header className="login-header">
        <div className="page-container login-header-inner">
          <Link to="/" className="login-back">
            <Icon name="arrow" />
            Back to home
          </Link>
          <Brand />
          <span className="login-header-note">
            <Icon name="spark" />A LITTLE MORE TOGETHER.
          </span>
        </div>
      </header>

      <main id="login-main" className="login-main page-container">
        <div className="login-card">
          <section className="login-form-panel" aria-labelledby="login-heading">
            <span className="eyebrow">
              YOUR PEOPLE. YOUR PLANS. YOUR FOREVER.
            </span>
            <h1 id="login-heading">
              Back to your
              <br />
              <em>beautiful beginning.</em>
            </h1>
            <p className="login-intro">
              A little less planning. A little more together.
              <br className="desktop-break" /> Your wedding plans are right
              where you left them.
            </p>
            <LoginForm />
            <div className="login-create-account">
              <span>New to Make My Marriage?</span>
              <Link to="/signup">
                Create an account
                <Icon name="arrow" />
              </Link>
            </div>
          </section>
          <LoginStory />
        </div>
        <p className="login-below-card">
          <Icon name="spark" />
          The beautiful chaos is better when you’re in it together.
        </p>
      </main>

      <footer className="login-footer">
        <div className="page-container login-footer-inner">
          <span>© {new Date().getFullYear()} Make My Marriage</span>
          <div>
            <button onClick={() => setDialogTopic("privacy")}>Privacy</button>
            <button onClick={() => setDialogTopic("terms")}>Terms</button>
            <button onClick={() => setDialogTopic("contact")}>
              Get in touch
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      </footer>
      <InfoDialog topic={dialogTopic} onClose={() => setDialogTopic(null)} />
    </div>
  );
}
