import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../ui/Brand";
import { Icon } from "../ui/Icon";

type SiteHeaderProps = {
  onStart: () => void;
};

const links = [
  { href: "#features", label: "The workspace" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-guests", label: "For your guests" },
];

export function SiteHeader({ onStart }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="page-container header-inner">
        <Brand />

        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="login-button" to="/login">
            Log in
          </Link>

          <button
            className="button button-primary header-cta"
            onClick={onStart}
          >
            Plan your wedding
            <Icon name="arrow" />
          </button>

          <button
            className="menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="mobile-nav"
          id="mobile-navigation"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
              <Icon name="arrow" />
            </a>
          ))}

          <button
            onClick={() => {
              setMenuOpen(false);
              onStart();
            }}
          >
            Plan your wedding
            <Icon name="arrow" />
          </button>
        </nav>
      )}
    </header>
  );
}
