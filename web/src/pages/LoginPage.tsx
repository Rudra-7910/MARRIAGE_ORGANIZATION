import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "../lib/api";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/ui/Brand";
import { Icon } from "../components/ui/Icon";
import { InfoDialog } from "../components/ui/InfoDialog";
import type { DialogTopic } from "../components/ui/InfoDialog";
import { LoginStory } from "../features/auth/components/LoginStory";

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
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(["auth-user"], user);
      navigate("/app/setup", { replace: true });
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
          <span className="login-header-note">
            <Icon name="spark" />A LITTLE MORE TOGETHER.
          </span>
        </div>
      </header>

      <main id="login-main" className="login-main page-container">
        <div className="login-card">
          <section className="login-form-panel" aria-labelledby="login-heading">
            <span className="eyebrow">
              YOUR PEOPLE. YOUR PLANS. YOUR FOREVER.
            </span>
            <h1 id="login-heading">
              Back to your
              <br />
              <em>beautiful beginning.</em>
            </h1>
            <p className="login-intro">
              A little less planning. A little more together.
              <br className="desktop-break" /> Your wedding plans are right
              where you left them.
            </p>
            <form
              className="login-form"
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              onChange={() => mutation.reset()}
              noValidate
            >
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
              <p className="login-session-note">
                Your login uses a secure, HTTP-only session cookie.
              </p>
            </form>
            <div className="login-create-account">
              <span>New to Make My Marriage?</span>
              <Link to="/signup">
                Create an account
                <Icon name="arrow" />
              </Link>
            </div>
          </section>
          <LoginStory />
        </div>
        <p className="login-below-card">
          <Icon name="spark" />
          The beautiful chaos is better when you’re in it together.
        </p>
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
