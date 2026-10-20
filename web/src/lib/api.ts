import axios from "axios";

export type AuthUser = { id: string; name: string; email: string };

// Vite forwards /api to Express. Cookies stay on the browser's current hostname.
export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 15000,
});

function requestError(error: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return new Error(
      error.response?.data?.error?.message ||
        "Could not reach the server. Please try again.",
    );
  }
  return new Error("The request could not be completed. Please try again.");
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await api.get<{ data: AuthUser }>("/auth/me");
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401)
      return null;
    throw requestError(error);
  }
}

async function authRequest<T>(path: string, values = {}) {
  try {
    // Keep CSRF protection: get the token using the same session cookie first.
    const csrf = await api.get<{ data: { token: string } }>("/auth/csrf");
    const response = await api.post<{ data: T }>("/auth/" + path, values, {
      headers: { "X-CSRF-Token": csrf.data.data.token },
    });
    return response.data.data;
  } catch (error) {
    throw requestError(error);
  }
}

export function login(values: { email: string; password: string }) {
  return authRequest<AuthUser>("login", values);
}
export function signup(values: {
  name: string;
  email: string;
  password: string;
}) {
  return authRequest<AuthUser>("signup", values);
}
export async function logout(): Promise<void> {
  await authRequest<null>("logout");
}
