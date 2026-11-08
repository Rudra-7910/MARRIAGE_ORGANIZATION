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
            <p>Wedding planning for both families.</p>
          </div>
          <div className="footer-links">
            <div>
              <span>Explore</span>
              <a href="#features">The workspace</a>
              <a href="#how-it-works">How it works</a>
              <a href="/app/setup">Your wedding workspace</a>
            </div>
            <div>
              <span>Help</span>
              <a href="#questions">FAQs</a>
              <button onClick={() => onInfo("contact")}>
                Contact
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Make My Marriage</span>
          <div>
            <button onClick={() => onInfo("privacy")}>Privacy</button>
            <button onClick={() => onInfo("terms")}>Terms</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
