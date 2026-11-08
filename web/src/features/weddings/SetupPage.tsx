import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Brand } from "../../components/ui/Brand";
import { logout, apiMessage } from "../../lib/api";
import type { AuthUser } from "../../lib/api";
import {
  createFamily,
  createWedding,
  getSetup,
  signedOut,
} from "../../lib/weddings";
import { WeddingForm } from "./WeddingForm";

export function SetupPage({ user }: { user: AuthUser }) {
  const query = useQuery({
    queryKey: ["wedding-setup", user.id],
    queryFn: getSetup,
    staleTime: 0,
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      cache.clear();
      navigate("/login", { replace: true });
    },
  });
  const { register, handleSubmit } = useForm<{
    name: string;
    side: "Bride" | "Groom" | "Both";
  }>({ defaultValues: { name: "", side: "Both" } });
  const familyMutation = useMutation({
    mutationFn: createFamily,
    onSuccess: (data) => {
      cache.setQueryData(["wedding-setup", user.id], data);
    },
  });
  const weddingMutation = useMutation({
    mutationFn: createWedding,
    onSuccess: (data) => {
      cache.setQueryData(["wedding-setup", user.id], data);
      cache.setQueryData(["wedding-dashboard", user.id], data);
      navigate("/app/overview", { replace: true });
    },
  });
  if (signedOut(query.error)) return <Navigate to="/login" replace />;
  if (query.data?.wedding) return <Navigate to="/app/overview" replace />;
  return (
    <div className="setup-page">
      <header className="setup-header">
        <Brand />
        <div>
          <span>{user.name}</span>
          <button
            className="ws-text-link"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            Log out
          </button>
        </div>
      </header>
      {signOut.isError && (
        <p className="ws-form-error" role="alert">
          {apiMessage(signOut.error)}
        </p>
      )}
      <main className="setup-main">
        <div className="setup-intro">
          <h1>Set up your wedding</h1>
          <p>
            Add your family first, then the ceremony date, venue and contact.
          </p>
          <p className="ws-help">
            Here as a service provider?{" "}
            <Link to="/app/provider">Create your service profile</Link> without
            registering a wedding.
          </p>
        </div>
        {query.isPending ? (
          <p role="status">Opening your setup…</p>
        ) : query.isError ? (
          <div className="ws-form-error" role="alert">
            {apiMessage(query.error)}
            <button className="ws-button" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="setup-grid">
            <div>
              <ol className="setup-steps">
                <li className={query.data.family ? "is-complete" : "is-active"}>
                  1. Your family
                </li>
                <li className={query.data.family ? "is-active" : ""}>
                  2. Wedding details
                </li>
              </ol>
              {!query.data.family ? (
                <form
                  className="ws-form"
                  onSubmit={handleSubmit((values) =>
                    familyMutation.mutate(values),
                  )}
                >
                  <section className="ws-panel">
                    <div className="ws-panel-heading">
                      <h2>First, your family</h2>
                    </div>
                    <div className="ws-settings-fields">
                      <p className="ws-help">
                        Registered by {user.name}. No extra accounts needed to
                        get started.
                      </p>
                      <label>
                        Family name
                        <input
                          required
                          minLength={2}
                          maxLength={100}
                          {...register("name")}
                        />
                      </label>
                      <label>
                        Family side
                        <select {...register("side")}>
                          <option value="Both">Both families</option>
                          <option value="Bride">Bride’s side</option>
                          <option value="Groom">Groom’s side</option>
                        </select>
                      </label>
                      {familyMutation.isError && (
                        <p role="alert" className="ws-form-error">
                          {apiMessage(familyMutation.error)}
                        </p>
                      )}
                      <div className="ws-form-actions">
                        <Link className="ws-button" to="/">
                          Back
                        </Link>
                        <button
                          className="ws-button ws-primary"
                          disabled={familyMutation.isPending}
                        >
                          {familyMutation.isPending
                            ? "Saving…"
                            : "Save & continue"}
                        </button>
                      </div>
                    </div>
                  </section>
                </form>
              ) : (
                <>
                  <div className="setup-family-summary">
                    <strong>{query.data.family.name}</strong>
                    <span>
                      {query.data.family.side === "Both"
                        ? "Both families"
                        : query.data.family.side + "’s side"}
                    </span>
                    <small>Registered by {user.name}</small>
                  </div>
                  <WeddingForm
                    onSave={(values) => weddingMutation.mutate(values)}
                    saving={weddingMutation.isPending}
                    error={
                      weddingMutation.isError
                        ? apiMessage(weddingMutation.error)
                        : undefined
                    }
                  />
                </>
              )}
            </div>
            <aside className="setup-story">
              <h2>What happens next</h2>
              <ol aria-label="Wedding setup flow">
                {["Add your family", "Set the wedding details", "Open your dashboard"].map(
                  (label, index) => (
                    <li key={label}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{label}</strong>
                        <p>
                          {
                            [
                              "Choose a family name and side.",
                              "Save the date, ceremony time and venue.",
                              "Manage departments, expenses and invitations.",
                            ][index]
                          }
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ol>
              <p className="setup-reassurance">
                You can change these details later. Your guest website stays in
                sync.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
