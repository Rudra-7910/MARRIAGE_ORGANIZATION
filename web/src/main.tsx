import "./styles/index.css";
import "./styles/login.css";
import "./styles/weddings.css";
import "./styles/dashboard.css";
import "./styles/invitations.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("The application root was not found.");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30000 } },
});

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
