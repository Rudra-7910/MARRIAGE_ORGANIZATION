import axios from "axios";

export type AuthUser = { id: string; name: string; email: string };

// Vite forwards /api to Express. Cookies stay on the browser's current hostname.
export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 15000,
});

export function apiMessage(error: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return (
      error.response?.data?.error?.message ||
      "Could not reach the server. Please try again."
    );
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await api.get<{ data: AuthUser }>("/auth/me");
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401)
      return null;
    throw new Error(apiMessage(error));
  }
}

// Shared by every write. Fetch a fresh token from the current session.
export async function getCsrfHeaders() {
  const response = await api.get<{ data: { token: string } }>("/auth/csrf");
  return { "X-CSRF-Token": response.data.data.token };
}

export async function login(values: { email: string; password: string }) {
  try {
    const response = await api.post<{ data: AuthUser }>("/auth/login", values, {
      headers: await getCsrfHeaders(),
    });
    return response.data.data;
  } catch (error) {
    throw new Error(apiMessage(error));
  }
}
export async function signup(values: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    const response = await api.post<{ data: AuthUser }>(
      "/auth/signup",
      values,
      {
        headers: await getCsrfHeaders(),
      },
    );
    return response.data.data;
  } catch (error) {
    throw new Error(apiMessage(error));
  }
}
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout", {}, { headers: await getCsrfHeaders() });
  } catch (error) {
    throw new Error(apiMessage(error));
  }
}
