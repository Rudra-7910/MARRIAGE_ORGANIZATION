import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, apiMessage, getCsrfHeaders } from "../lib/api";
import { Brand } from "../components/ui/Brand";
import { Icon } from "../components/ui/Icon";
import { LoginStory } from "../features/auth/LoginStory";

export function RecoveryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const reset = location.pathname === "/reset-password";
  const [token] = useState(() => location.hash.slice(1));
  const validToken = z.hex().length(64).safeParse(token).success;
  const [visible, setVisible] = useState(false);
  // Keep the bearer token in this page's memory, out of copied URLs/history.
  useEffect(() => {
    if (reset && location.hash) navigate("/reset-password", { replace: true });
  }, [reset, location.hash, navigate]);
  const schema = z
    .object({
      email: reset
        ? z.string()
        : z.string().trim().email("Enter a valid email address."),
      password: reset
        ? z
            .string()
            .min(8, "Use at least 8 characters.")
            .refine(
              (value) => new TextEncoder().encode(value).length <= 72,
              "Use a password of at most 72 bytes.",
            )
        : z.string(),
      confirmPassword: z.string(),
    })
    .refine((value) => !reset || value.password === value.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const response = await api.post<{ data: { message: string } }>(
        reset ? "/auth/reset-password" : "/auth/forgot-password",
        reset ? { token, password: values.password } : { email: values.email },
        { headers: await getCsrfHeaders() },
      );
      return response.data.data;
    },
    onSuccess: () => {
      if (reset) cache.clear();
    },
  });
  return (
    <div className="login-page">
      <header className="login-header">
        <div className="page-container login-header-inner">
          <Link to="/login" className="login-back">
            <Icon name="arrow" />
            Back to log in
          </Link>
          <Brand />
        </div>
      </header>
      <main className="login-main page-container">
        <div className="login-card">
          <section
            className="login-form-panel"
            aria-labelledby="recovery-title"
          >
            <h1 id="recovery-title">
              {reset ? "Reset your password" : "Forgot your password?"}
            </h1>
            <p className="login-intro">
              {reset
                ? "Choose a new password for your account."
                : "Enter your account email. We’ll send you a link to get back in."}
            </p>
            {mutation.isSuccess ? (
              <div role="status" className="recovery-result">
                <Icon name="check" />
                <p>{mutation.data.message}</p>
                <Link to="/login" className="button button-primary">
                  Back to log in <Icon name="arrow" />
                </Link>
              </div>
            ) : reset && !validToken ? (
              <div className="recovery-result" role="alert">
                <p>
                  Open the complete link from your reset email. If it has
                  expired, request a new one.
                </p>
                <Link to="/forgot-password" className="button button-primary">
                  Request a new link
                </Link>
              </div>
            ) : (
              <form
                className="login-form"
                noValidate
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
              >
                {!reset ? (
                  <div className="login-field">
                    <label htmlFor="recovery-email">Email address</label>
                    <div className="login-input-wrap">
                      <Icon name="mail" />
                      <input
                        id="recovery-email"
                        type="email"
                        autoComplete="username"
                        {...register("email")}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={
                          errors.email ? "recovery-email-error" : undefined
                        }
                      />
                    </div>
                    {errors.email && (
                      <p
                        className="login-field-error"
                        id="recovery-email-error"
                        role="alert"
                      >
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="login-field">
                      <label htmlFor="recovery-password">New password</label>
                      <div className="login-input-wrap password-input-wrap">
                        <Icon name="lock" />
                        <input
                          id="recovery-password"
                          type={visible ? "text" : "password"}
                          autoComplete="new-password"
                          {...register("password")}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={
                            errors.password
                              ? "recovery-password-error"
                              : undefined
                          }
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={
                            visible ? "Hide password" : "Show password"
                          }
                          aria-pressed={visible}
                          onClick={() => setVisible(!visible)}
                        >
                          <Icon name={visible ? "eye-off" : "eye"} />
                        </button>
                      </div>
                      {errors.password && (
                        <p
                          className="login-field-error"
                          id="recovery-password-error"
                          role="alert"
                        >
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="login-field">
                      <label htmlFor="recovery-confirm">
                        Confirm new password
                      </label>
                      <div className="login-input-wrap">
                        <Icon name="lock" />
                        <input
                          id="recovery-confirm"
                          type={visible ? "text" : "password"}
                          autoComplete="new-password"
                          {...register("confirmPassword")}
                          aria-invalid={Boolean(errors.confirmPassword)}
                          aria-describedby={
                            errors.confirmPassword
                              ? "recovery-confirm-error"
                              : undefined
                          }
                        />
                      </div>
                      {errors.confirmPassword && (
                        <p
                          className="login-field-error"
                          id="recovery-confirm-error"
                          role="alert"
                        >
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {mutation.isError && (
                  <p className="ws-form-error" role="alert">
                    {apiMessage(mutation.error)}
                  </p>
                )}
                <button
                  className="button button-primary login-submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? "Please wait…"
                    : reset
                      ? "Save new password"
                      : "Send reset link"}
                  <Icon name="arrow" />
                </button>
                <p className="login-session-note">
                  {reset
                    ? "Resetting signs out your other sessions."
                    : "Links expire after 15 minutes and can be used once."}
                </p>
              </form>
            )}
          </section>
          <LoginStory />
        </div>
      </main>
    </div>
  );
}
