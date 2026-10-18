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
            <span className="eyebrow">BACK TO YOUR PEOPLE, AND YOUR PLANS</span>
            <h1 id="login-heading">Welcome back.</h1>
            <p className="login-intro">
              Your wedding plans, right where you left them.
              <br className="desktop-break" /> Log in to bring everything
              together.
            </p>
            <LoginForm />
            <div className="login-create-account">
              <span>New to Make My Marriage?</span>
              <button onClick={() => setDialogTopic("start")}>
                Create an account
                <Icon name="arrow" />
              </button>
            </div>
            <Link to="/#sample-workspace" className="login-sample-link">
              <span className="login-sample-icon">
                <Icon name="eye" />
              </span>
              <span>
                Just taking a look?
                <strong>
                  Explore a sample wedding
                  <Icon name="arrow" />
                </strong>
              </span>
            </Link>
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
