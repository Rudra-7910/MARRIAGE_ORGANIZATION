import "./lib/language";
import "./styles/index.css";
import "./styles/login.css";
import "./styles/weddings.css";
import "./styles/dashboard.css";
import "./styles/invitations.css";
import "./styles/celebration.css";
import "./styles/planning.css";
import "./styles/guest.css";
import "./styles/providers.css";
import "./styles/integrations.css";
import "./styles/finance.css";
import "./styles/media.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ErrorBoundary } from "react-error-boundary";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("The application root was not found.");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30000 } },
});

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <main className="ws-empty" role="alert">
          <h1>This page couldn’t load</h1>
          <p>Reload the page to try again.</p>
          <button
            className="ws-button ws-primary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <a href="/">Back to home</a>
        </main>
      }
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
