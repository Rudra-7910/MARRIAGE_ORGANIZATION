import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../../lib/api";
import { AccountRoutes } from "../weddings/WeddingApp";

export function AuthGate() {
  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: getCurrentUser,
    staleTime: 0,
  });
  if (query.isPending)
    return (
      <main className="ws-empty" role="status">
        <h1>Opening your workspace…</h1>
      </main>
    );
  if (query.isError)
    return (
      <main className="ws-empty">
        <h1>Couldn’t check your session</h1>
        <p role="alert">{query.error.message}</p>
        <button className="ws-button" onClick={() => query.refetch()}>
          Try again
        </button>
      </main>
    );
  if (!query.data) return <Navigate to="/login" replace />;
  return <AccountRoutes key={query.data.id} user={query.data} />;
}
