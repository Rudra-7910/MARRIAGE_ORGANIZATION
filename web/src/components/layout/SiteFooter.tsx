import { Brand } from "../ui/Brand";
import { Icon } from "../ui/Icon";
import type { DialogTopic } from "../ui/InfoDialog";

export function SiteFooter({
  onInfo,
}: {
  onInfo: (topic: DialogTopic) => void;
}) {
  return (
    <footer className="site-footer">
      <div className="page-container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              For the wedding.
              <br />
              And everyone who makes it happen.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <span>EXPLORE</span>
              <a href="#features">The workspace</a>
              <a href="#how-it-works">How it works</a>
              <a href="#sample-workspace">Sample wedding</a>
            </div>
            <div>
              <span>A LITTLE MORE</span>
              <a href="#questions">FAQs</a>
              <button onClick={() => onInfo("contact")}>
                Get in touch
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Make My Marriage</span>
          <p>Made for the beautiful chaos of Indian weddings.</p>
          <div>
            <button onClick={() => onInfo("privacy")}>Privacy</button>
            <button onClick={() => onInfo("terms")}>Terms</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
