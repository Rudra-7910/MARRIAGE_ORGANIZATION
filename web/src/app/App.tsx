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

export function App() {
  const location = useLocation();

  useEffect(() => {
    const sectionTitles: Record<string, string> = {
      login: "Log in",
      signup: "Create account",
      overview: "Overview",
      setup: "Set up your wedding",
      edit: "Edit wedding",
      functions: "Functions",
      departments: "Teams & Services",
      budget: "Budget & Expenses",
      guests: "Guests & Invitations",
      invitation: "Send email invitation",
      photos: "Photos",
      services: "Find Services",
      members: "People & Access",
      "guest-website": "Guest Website",
      settings: "Wedding Settings",
    };
    const section = location.pathname.split("/").filter(Boolean).pop() || "";
    document.title = sectionTitles[section]
      ? sectionTitles[section] + " — Make My Marriage"
      : "Make My Marriage — A little less follow-up. A lot more shaadi.";

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/demo/*"
          element={<Navigate to="/app/overview" replace />}
        />
        <Route path="/app/*" element={<AuthGate />} />
        <Route path="/w/:publicId" element={<GuestWeddingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
