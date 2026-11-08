import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { accountPathFromState, getCurrentUser } from "../../lib/api";
import { inviteTokenFromState } from "../../lib/team";
const AccountRoutes = lazy(() =>
  import("../weddings/WeddingApp").then((module) => ({
    default: module.AccountRoutes,
  })),
);

export function AuthGate({ guestOnly = false }: { guestOnly?: boolean }) {
  const location = useLocation();
  const query = useQuery({
    queryKey: ["auth-user"],
    queryFn: getCurrentUser,
    staleTime: 0,
    refetchOnMount: "always",
  });
  // Verify the session on entry even when an old user/null is cached. Later
  // background refreshes must not unmount the workspace and reconnect sockets.
  if (query.isPending || !query.isFetchedAfterMount)
    return (
      <main className="ws-empty" role="status">
        <h1>Checking your session…</h1>
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
  if (guestOnly) {
    if (!query.data) return <Outlet />;
    const invitation = inviteTokenFromState(location.state);
    return (
      <Navigate
        to={
          invitation
            ? "/team-invites#" + invitation
            : accountPathFromState(location.state)
        }
        replace
      />
    );
  }
  if (!query.data)
    return (
      <Navigate
        to="/login"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    );
  return <AccountRoutes key={query.data.id} user={query.data} />;
}
