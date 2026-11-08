import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { accountPathFromState, login } from "../lib/api";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { inviteTokenFromState } from "../lib/team";
import { Brand } from "../components/ui/Brand";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";
import { LoginStory } from "../features/auth/LoginStory";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  // Login checks only that a password is present; signup rules belong in signup.
  password: z.string().min(1, "Enter your password."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [dialogTopic, setDialogTopic] = useState<DialogTopic | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const teamInviteToken = inviteTokenFromState(location.state);
  const returnTo = accountPathFromState(location.state);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(["auth-user"], user);
      navigate(
        teamInviteToken ? "/team-invites#" + teamInviteToken : returnTo,
        { replace: true },
      );
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  return (
    <div className="login-page">
      <a href="#login-main" className="skip-link">
        Skip to login
      </a>
      <header className="login-header">
        <div className="page-container login-header-inner">
          <Link to="/" className="login-back">
            <Icon name="arrow" />
            Back to home
          </Link>
          <Brand />
        </div>
      </header>

      <main id="login-main" className="login-main page-container">
        <div className="login-card">
          <section className="login-form-panel" aria-labelledby="login-heading">
            <h1 id="login-heading">Welcome back.</h1>
            <p className="login-intro">
              Log in to manage your wedding plans.
            </p>
            <form
              className="login-form"
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              onChange={() => mutation.reset()}
              noValidate
            >
              {teamInviteToken && (
                <p className="team-note">
                  After logging in, you’ll return to your wedding team
                  invitation.
                </p>
              )}
              <div className="login-field">
                <label htmlFor="login-email">Email address</label>
                <div
                  className={`login-input-wrap ${errors.email ? "has-error" : ""}`}
                >
                  <Icon name="mail" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? "login-email-error" : undefined
                    }
                    required
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p
                    id="login-email-error"
                    className="login-field-error"
                    role="alert"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div
                  className={`login-input-wrap password-input-wrap ${errors.password ? "has-error" : ""}`}
                >
                  <Icon name="lock" />
                  <input
                    id="login-password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "login-password-error" : undefined
                    }
                    required
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    <Icon name={passwordVisible ? "eye-off" : "eye"} />
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="login-password-error"
                    className="login-field-error"
                    role="alert"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Link className="recovery-link" to="/forgot-password">
                Forgot your password?
              </Link>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="button button-primary login-submit"
              >
                {mutation.isPending ? "Logging in…" : "Log in"}
                <Icon name="arrow" />
              </button>

              {mutation.isError && (
                <p className="ws-form-error" role="alert">
                  {mutation.error.message}
                </p>
              )}
            </form>
            <div className="login-create-account">
              <span>New to Make My Marriage?</span>
              <Link
                to="/signup"
                state={teamInviteToken ? { teamInviteToken } : { returnTo }}
              >
                Create an account
                <Icon name="arrow" />
              </Link>
            </div>
          </section>
          <LoginStory />
        </div>
      </main>

      <footer className="login-footer">
        <div className="page-container login-footer-inner">
          <span>© {new Date().getFullYear()} Make My Marriage</span>
          <div>
            <button onClick={() => setDialogTopic("privacy")}>Privacy</button>
            <button onClick={() => setDialogTopic("terms")}>Terms</button>
            <button onClick={() => setDialogTopic("contact")}>
              Get in touch
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      </footer>
      <InfoDialog topic={dialogTopic} onClose={() => setDialogTopic(null)} />
    </div>
  );
}
