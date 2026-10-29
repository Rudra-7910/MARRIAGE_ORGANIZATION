import { useLocation, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brand } from "../../components/ui/Brand";
import { Icon } from "../../components/ui/Icon";
import { getCurrentUser, apiMessage } from "../../lib/api";
import { weddingDate } from "../../lib/weddings";
import {
  acceptTeamInvite,
  previewTeamInvite,
  roleDescriptions,
} from "../../lib/team";

export function TeamInvitePage() {
  const location = useLocation();
  const token = location.hash.slice(1);
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const user = useQuery({
    queryKey: ["auth-user"],
    queryFn: getCurrentUser,
    staleTime: 0,
  });
  const invite = useQuery({
    queryKey: ["team-invite-preview", token],
    queryFn: ({ signal }) => previewTeamInvite(token, signal),
    enabled: validToken,
    retry: false,
    gcTime: 0,
  });
  const accept = useMutation({
    mutationFn: () => acceptTeamInvite(token),
    onSuccess: () => {
      // Clear any previous workspace and private query results before opening this one.
      cache.clear();
      cache.setQueryData(["auth-user"], user.data);
      navigate("/app/overview", { replace: true });
    },
  });
  return (
    <div className="login-page team-invite-page">
      <header className="login-header">
        <div className="page-container login-header-inner">
          <Brand />
          <Link to="/">Back to home</Link>
        </div>
      </header>
      <main className="team-invite-card">
        <span className="dash-kicker">
          <Icon name="people" /> A LITTLE MORE TOGETHER
        </span>
        {!validToken ? (
          <>
            <h1>Invitation unavailable</h1>
            <p>
              This invitation link is incomplete. Ask your organizer to share
              the full link.
            </p>
          </>
        ) : invite.isPending ? (
          <p role="status">Opening your wedding team invitation…</p>
        ) : invite.isError ? (
          <>
            <h1>Invitation unavailable</h1>
            <p role="alert">{apiMessage(invite.error)}</p>
            <button className="ws-button" onClick={() => invite.refetch()}>
              Try again
            </button>
          </>
        ) : (
          invite.data && (
            <>
              <h1>You’re invited to help.</h1>
              <h2>
                {invite.data.brideName} & {invite.data.groomName}
              </h2>
              <p className="team-invite-date">
                {weddingDate(invite.data.date)}
              </p>
              <div className="team-invite-access">
                <span className="dash-badge">{invite.data.role} access</span>
                <p>{roleDescriptions[invite.data.role]}</p>
              </div>
              {user.isPending ? (
                <p role="status">Checking your login…</p>
              ) : user.isError ? (
                <>
                  <p className="ws-form-error" role="alert">
                    {user.error.message}
                  </p>
                  <button className="ws-button" onClick={() => user.refetch()}>
                    Retry login check
                  </button>
                </>
              ) : user.data ? (
                <>
                  <p>
                    Joining as <strong>{user.data.name}</strong> (
                    {user.data.email}).
                  </p>
                  <button
                    className="ws-button ws-primary"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate()}
                  >
                    {accept.isPending
                      ? "Joining wedding…"
                      : "Accept & join as " + invite.data.role}
                    <Icon name="arrow" />
                  </button>
                  {accept.isError && (
                    <p className="ws-form-error" role="alert">
                      {apiMessage(accept.error)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Log in or create an account to join. No family registration
                    or wedding setup is needed.
                  </p>
                  <div className="celebration-actions">
                    <Link
                      className="ws-button ws-primary"
                      to="/login"
                      state={{ teamInviteToken: token }}
                    >
                      Log in to accept
                    </Link>
                    <Link
                      className="ws-button"
                      to="/signup"
                      state={{ teamInviteToken: token }}
                    >
                      Create an account
                    </Link>
                  </div>
                </>
              )}
              <p className="team-note">
                This link works once and expires{" "}
                {new Date(invite.data.expiresAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST. Your access applies only to this wedding.
              </p>
            </>
          )
        )}
      </main>
    </div>
  );
}
