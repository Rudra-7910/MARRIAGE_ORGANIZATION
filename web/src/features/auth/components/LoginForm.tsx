import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login } from "../../../lib/api";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Icon } from "../../../components/ui/Icon";
import { loginSchema } from "../login-schema";
import type { LoginFormValues } from "../login-schema";

export function LoginForm() {
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
    <form
      className="login-form"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      onChange={() => mutation.reset()}
      noValidate
    >
      <div className="login-field">
        <label htmlFor="login-email">Email address</label>
        <div className={`login-input-wrap ${errors.email ? "has-error" : ""}`}>
          <Icon name="mail" />
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            required
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p id="login-email-error" className="login-field-error" role="alert">
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
            aria-label={passwordVisible ? "Hide password" : "Show password"}
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
  );
}
