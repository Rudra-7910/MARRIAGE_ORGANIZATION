import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Brand } from "../../components/ui/Brand";
import { logout } from "../../lib/api";
import type { AuthUser } from "../../lib/api";
import {
  apiMessage,
  createFamily,
  createWedding,
  getSetup,
  signedOut,
} from "../../lib/weddings";
import type { Workspace } from "../../lib/weddings";
import { WeddingForm } from "./WeddingForm";

export function AccountHeader({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      cache.clear();
      navigate("/login", { replace: true });
    },
  });
  return (
    <>
      <header className="setup-header">
        <Brand />
        <div>
          <span>{user.name}</span>
          <button
            className="ws-text-link"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            Log out
          </button>
        </div>
      </header>
      {mutation.isError && (
        <p className="ws-form-error" role="alert">
          {apiMessage(mutation.error)}
        </p>
      )}
    </>
  );
}
export function SetupDiagram() {
  return (
    <aside className="setup-story">
      <span className="ws-eyebrow">ONE BEAUTIFUL BEGINNING</span>
      <h2>
        From your family,
        <br />
        <em>to your forever.</em>
      </h2>
      <ol aria-label="Wedding setup flow">
        {["Your family", "Your wedding", "One shared dashboard"].map(
          (label, index) => (
            <li key={label}>
              <span>{index + 1}</span>
              <div>
                <strong>{label}</strong>
                <p>
                  {
                    [
                      "Give your family a shared place.",
                      "Add the details that make it yours.",
                      "Your plans and guest website, in sync.",
                    ][index]
                  }
                </p>
              </div>
            </li>
          ),
        )}
      </ol>
      <p className="setup-reassurance">
        You can change these details later. Your guest website stays in sync.
      </p>
    </aside>
  );
}
export function SetupPage({ user }: { user: AuthUser }) {
  const query = useQuery({
    queryKey: ["wedding-setup", user.id],
    queryFn: getSetup,
    staleTime: 0,
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm<{
    name: string;
    side: "Bride" | "Groom" | "Both";
  }>({ defaultValues: { name: "", side: "Both" } });
  function saved(data: Workspace) {
    cache.setQueryData(["wedding-setup", user.id], data);
  }
  const familyMutation = useMutation({
    mutationFn: createFamily,
    onSuccess: saved,
  });
  const weddingMutation = useMutation({
    mutationFn: createWedding,
    onSuccess: (data) => {
      saved(data);
      cache.setQueryData(["wedding-dashboard", user.id], data);
      navigate("/app/overview", { replace: true });
    },
  });
  if (signedOut(query.error)) return <Navigate to="/login" replace />;
  if (query.data?.wedding) return <Navigate to="/app/overview" replace />;
  return (
    <div className="setup-page">
      <AccountHeader user={user} />
      <main className="setup-main">
        <div className="setup-intro">
          <span className="ws-eyebrow">LET’S MAKE ROOM FOR YOUR PEOPLE</span>
          <h1>
            Your wedding,
            <br />
            <em>your beginning.</em>
          </h1>
          <p>
            A few details to bring your family and your celebration together.
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
            <SetupDiagram />
          </div>
        )}
      </main>
    </div>
  );
}
