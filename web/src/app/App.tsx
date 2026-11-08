import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const SignupPage = lazy(() =>
  import("../pages/SignupPage").then((module) => ({
    default: module.SignupPage,
  })),
);
const RecoveryPage = lazy(() =>
  import("../pages/RecoveryPage").then((module) => ({
    default: module.RecoveryPage,
  })),
);
const AuthGate = lazy(() =>
  import("../features/auth/AuthGate").then((module) => ({
    default: module.AuthGate,
  })),
);
const GuestWeddingPage = lazy(() =>
  import("../features/weddings/GuestWeddingPage").then((module) => ({
    default: module.GuestWeddingPage,
  })),
);
const TeamInvitePage = lazy(() =>
  import("../features/weddings/TeamInvitePage").then((module) => ({
    default: module.TeamInvitePage,
  })),
);
const ServicesPage = lazy(() =>
  import("../features/weddings/ServicesPage").then((module) => ({
    default: module.ServicesPage,
  })),
);
const ProviderPage = lazy(() =>
  import("../features/providers/ProviderPage").then((module) => ({
    default: module.ProviderPage,
  })),
);
const UploadPage = lazy(() =>
  import("../features/media/UploadPage").then((module) => ({
    default: module.UploadPage,
  })),
);

export function App() {
  const location = useLocation();

  useEffect(() => {
    const sectionTitles: Record<string, string> = {
      login: "Log in",
      signup: "Create account",
      "forgot-password": "Recover your account",
      "reset-password": "Choose a new password",
      overview: "Overview",
      setup: "Set up your wedding",
      edit: "Edit wedding",
      functions: "Functions",
      departments: "Teams & Services",
      attention: "Need Your Attention",
      budget: "Budget & Expenses",
      guests: "Guests & Invitations",
      invitation: "Send email invitation",
      photos: "Photos",
      services: "Find Services",
      members: "People & Access",
      "guest-website": "Guest Website",
      settings: "Wedding Settings",
      "team-invites": "Join the wedding team",
      provider: "Your service profile",
      "service-profile": "Wedding service profile",
      "photo-upload": "Share wedding photos",
      announcements: "Guest updates",
    };
    const section = location.pathname.startsWith("/services/")
      ? "service-profile"
      : location.pathname.startsWith("/upload/")
        ? "photo-upload"
        : location.pathname.split("/").filter(Boolean).pop() || "";
    document.title = sectionTitles[section]
      ? sectionTitles[section] + " — Make My Marriage"
      : "Make My Marriage — Wedding planning for both families";

    if (location.hash) {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ behavior: "auto", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname, location.hash, location.key]);

  return (
    <Suspense
      fallback={
        <main className="ws-empty" role="status">
          Loading page…
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<AuthGate key="guest" guestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/forgot-password"
            element={<RecoveryPage key="forgot" />}
          />
        </Route>
        <Route path="/reset-password" element={<RecoveryPage key="reset" />} />
        <Route path="/team-invites" element={<TeamInvitePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:providerId" element={<ProviderPage />} />
        <Route
          path="/upload/:publicId"
          element={<UploadPage key={location.pathname + location.hash} />}
        />
        <Route
          path="/demo/*"
          element={<Navigate to="/app/overview" replace />}
        />
        <Route path="/app/*" element={<AuthGate key="private" />} />
        <Route
          path="/w/:publicId"
          element={<GuestWeddingPage key={location.pathname} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
