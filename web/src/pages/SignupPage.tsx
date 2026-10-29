import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { inviteTokenFromState } from "../lib/team";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signup } from "../lib/api";
import { Brand } from "../components/ui/Brand";
import { Icon } from "../components/ui/Icon";
import { LoginStory } from "../features/auth/LoginStory";

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your name (at least 2 characters).")
      .max(80),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "Use a password of at most 72 bytes.",
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
type SignupValues = z.infer<typeof signupSchema>;

const signupFields = [
  {
    name: "name",
    label: "Your name",
    type: "text",
    autoComplete: "name",
    icon: "people",
  },
  {
    name: "email",
    label: "Email address",
    type: "email",
    autoComplete: "username",
    icon: "mail",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    icon: "lock",
  },
  {
    name: "confirmPassword",
    label: "Confirm password",
    type: "password",
    autoComplete: "new-password",
    icon: "lock",
  },
] as const;

export function SignupPage() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const teamInviteToken = inviteTokenFromState(location.state);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });
  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(["auth-user"], user);
      navigate(
        teamInviteToken ? "/team-invites#" + teamInviteToken : "/app/setup",
        { replace: true },
      );
    },
  });
  return (
    <div className="login-page">
      <header className="login-header">
        <div className="page-container login-header-inner">
          <Link to="/" className="login-back">
            <Icon name="arrow" />
            Back to home
          </Link>
          <Brand />
          <span className="login-header-note">A LITTLE MORE TOGETHER.</span>
        </div>
      </header>
      <main className="login-main page-container">
        <div className="login-card">
          <section
            className="login-form-panel"
            aria-labelledby="signup-heading"
          >
            <span className="eyebrow">
              FOR THE PEOPLE BRINGING IT ALL TOGETHER
            </span>
            <h1 id="signup-heading">A beautiful beginning.</h1>
            <p className="login-intro">
              Couple, sibling, friend or parent — anyone helping plan the
              wedding can get started.
            </p>
            <form
              className="login-form"
              noValidate
              onSubmit={handleSubmit(({ name, email, password }) =>
                mutation.mutate({ name, email, password }),
              )}
              onChange={() => mutation.reset()}
            >
              {signupFields.map((field) => (
                <div className="login-field" key={field.name}>
                  <label htmlFor={"signup-" + field.name}>{field.label}</label>
                  <div
                    className={
                      "login-input-wrap " +
                      (errors[field.name] ? "has-error" : "")
                    }
                  >
                    <Icon name={field.icon} />
                    <input
                      id={"signup-" + field.name}
                      type={
                        field.type === "password" && visible
                          ? "text"
                          : field.type
                      }
                      autoComplete={field.autoComplete}
                      required
                      aria-invalid={!!errors[field.name]}
                      aria-describedby={
                        errors[field.name]
                          ? "signup-" + field.name + "-error"
                          : undefined
                      }
                      {...register(field.name)}
                    />
                    {field.name === "password" && (
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setVisible(!visible)}
                        aria-label={
                          visible ? "Hide passwords" : "Show passwords"
                        }
                      >
                        <Icon name={visible ? "eye-off" : "eye"} />
                      </button>
                    )}
                  </div>
                  {errors[field.name] && (
                    <p
                      id={"signup-" + field.name + "-error"}
                      role="alert"
                      className="login-field-error"
                    >
                      {errors[field.name]?.message}
                    </p>
                  )}
                </div>
              ))}
              <button
                className="button button-primary login-submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Creating account…" : "Create account"}
                <Icon name="arrow" />
              </button>
              {mutation.isError && (
                <p className="ws-form-error" role="alert">
                  {mutation.error.message}
                </p>
              )}
              <p className="login-session-note">
                {teamInviteToken
                  ? "No email verification needed. Next, review and accept your wedding team invitation."
                  : "No email verification needed for v1. Next, register your family and create your wedding."}
              </p>
            </form>
            <div className="login-create-account">
              <span>Already have an account?</span>
              <Link
                to="/login"
                state={teamInviteToken ? { teamInviteToken } : undefined}
              >
                Log in
                <Icon name="arrow" />
              </Link>
            </div>
          </section>
          <LoginStory />
        </div>
      </main>
      <footer className="login-footer">
        <div className="page-container login-footer-inner">
          © {new Date().getFullYear()} Make My Marriage
        </div>
      </footer>
    </div>
  );
}
