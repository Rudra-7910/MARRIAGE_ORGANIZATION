import { LanguageToggle } from "../integrations/LanguageToggle";
import { LiveUpdates } from "../integrations/LiveUpdates";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Brand } from "../../components/ui/Brand";
import { Icon } from "../../components/ui/Icon";
import type { IconName } from "../../components/ui/Icon";
import { logout, apiMessage } from "../../lib/api";
import type { AuthUser } from "../../lib/api";
import { canOrganize, weddingDate } from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";

const navigation: {
  path: string;
  label: string;
  icon: IconName;
  organizer?: boolean;
}[] = [
  { path: "overview", label: "Overview", icon: "dashboard" },
  { path: "functions", label: "Functions", icon: "calendar" },
  { path: "departments", label: "Teams & Services", icon: "people" },
  { path: "attention", label: "Need Your Attention", icon: "flag" },
  {
    path: "budget",
    label: "Budget & Expenses",
    icon: "wallet",
    organizer: true,
  },
  { path: "guests", label: "Guests & Invites", icon: "mail", organizer: true },
  {
    path: "announcements",
    label: "Guest updates",
    icon: "message",
    organizer: true,
  },
  { path: "services", label: "Find Services", icon: "store" },
  { path: "photos", label: "Photos", icon: "camera" },
  { path: "guest-website", label: "Guest Website", icon: "globe" },
];

export function DashboardLayout({
  user,
  data,
  children,
}: {
  user: AuthUser;
  data: Workspace;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(false);
  useEffect(() => {
    const screen = window.matchMedia("(max-width: 960px)");
    function updateNavigation() {
      setMobileNavigation(screen.matches);
      if (!screen.matches) setMenuOpen(false);
    }
    updateNavigation();
    screen.addEventListener("change", updateNavigation);
    return () => screen.removeEventListener("change", updateNavigation);
  }, []);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const wedding = data.wedding!;
  const organizer = canOrganize(data.role);
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      cache.clear();
      navigate("/login", { replace: true });
    },
  });

  return (
    <div
      className="organizer-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <LiveUpdates userId={user.id} />
      <a className="skip-link" href="#dashboard-content">
        Skip to dashboard
      </a>
      {menuOpen && (
        <button
          className="dash-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="dashboard-sidebar"
        inert={mobileNavigation && !menuOpen}
        className={"dash-sidebar" + (menuOpen ? " is-open" : "")}
      >
        <div className="dash-brand">
          <Brand />
          <span>Family workspace</span>
        </div>
        <div className="dash-wedding-switcher">
          <span className="dash-tiny-label">Your wedding</span>
          <strong>
            {wedding.brideName} & {wedding.groomName}
          </strong>
          <span>
            <Icon name="calendar" />
            {weddingDate(wedding.date)}
          </span>
          <span>
            <Icon name="pin" />
            {wedding.city}
          </span>
        </div>
        <nav aria-label="Wedding navigation" onClick={() => setMenuOpen(false)}>
          {navigation
            .filter((item) => !item.organizer || organizer)
            .map((item) => (
              <NavLink
                to={"/app/" + item.path}
                className="dash-nav-link"
                key={item.path}
              >
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
                {item.path === "services" && <small>Nearby</small>}
                {item.organizer && (
                  <Icon name="lock" className="dash-nav-lock" />
                )}
              </NavLink>
            ))}
        </nav>
        <div className="dash-sidebar-bottom" onClick={() => setMenuOpen(false)}>
          <span className="dash-tiny-label">Your workspace</span>
          {organizer && (
            <NavLink to="/app/settings" className="dash-nav-link">
              <Icon name="settings" />
              <span>{t("Wedding Settings")}</span>
            </NavLink>
          )}
          <NavLink to="/app/members" className="dash-nav-link">
            <Icon name="people" />
            <span>{t("People & Access")}</span>
          </NavLink>
          <NavLink to="/app/provider" className="dash-nav-link">
            <Icon name="store" />
            <span>{t("Your service profile")}</span>
          </NavLink>
        </div>
      </aside>

      <div className="dash-body">
        <header className="dash-topbar">
          <div className="dash-topbar-title">
            <button
              className="dash-mobile-menu"
              aria-label="Toggle wedding navigation"
              aria-expanded={menuOpen}
              aria-controls="dashboard-sidebar"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="menu" />
            </button>
            <div>
              <strong>
                {wedding.brideName} & {wedding.groomName}
              </strong>
              <span>
                {wedding.city}, {weddingDate(wedding.date)}
              </span>
            </div>
          </div>
          <div className="dash-account-actions">
            <LanguageToggle />
            <Link className="dash-guest-link" to={"/w/" + wedding.publicId}>
              {t("View guest website")} <Icon name="arrow" />
            </Link>
            <div className="dash-account">
              <span className="dash-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <span>{data.role}</span>
              </div>
            </div>
            <button
              className="dash-logout"
              aria-label="Log out"
              title="Log out"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        {signOut.isError && (
          <p className="ws-form-error" role="alert">
            {apiMessage(signOut.error)}
          </p>
        )}
        <main id="dashboard-content" className="dash-content">
          {children}
        </main>
        <footer className="dash-footer">
          <span>Make My Marriage</span>
        </footer>
      </div>
    </div>
  );
}
