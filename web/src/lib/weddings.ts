import axios from "axios";
import { api } from "./api";

export type WeddingInput = {
  brideName: string;
  groomName: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  contactRole: string;
  phone: string;
  welcome: string;
  youtube: string;
};
export type WeddingDetails = WeddingInput & { publicId: string };
export type WeddingRecord = WeddingDetails & {
  version: number;
  updatedAt: string;
};
export type Workspace = {
  family: { id: string; name: string; side: "Bride" | "Groom" | "Both" } | null;
  wedding: WeddingRecord | null;
  role: "Organizer" | "Manager" | "Worker" | null;
};

export async function getSetup() {
  return (await api.get<{ data: Workspace }>("/setup")).data.data;
}
export async function getDashboard() {
  return (await api.get<{ data: Workspace }>("/dashboard")).data.data;
}
export async function getGuestWedding(publicId: string) {
  return (
    await api.get<{ data: WeddingDetails }>(
      "/public/weddings/" + encodeURIComponent(publicId),
    )
  ).data.data;
}

async function csrfHeaders() {
  const response = await api.get<{ data: { token: string } }>("/auth/csrf");
  return { "X-CSRF-Token": response.data.data.token };
}
export async function createFamily(values: {
  name: string;
  side: "Bride" | "Groom" | "Both";
}) {
  return (
    await api.post<{ data: Workspace }>("/families", values, {
      headers: await csrfHeaders(),
    })
  ).data.data;
}
export async function createWedding(values: WeddingInput) {
  return (
    await api.post<{ data: Workspace }>("/weddings", values, {
      headers: await csrfHeaders(),
    })
  ).data.data;
}
export async function editWedding(values: WeddingInput, version: number) {
  return (
    await api.patch<{ data: Workspace }>(
      "/weddings/current",
      { ...values, version },
      { headers: await csrfHeaders() },
    )
  ).data.data;
}
export function apiMessage(error: unknown) {
  return axios.isAxiosError(error)
    ? error.response?.data?.error?.message ||
        "Could not reach the server. Please try again."
    : "Something went wrong. Please try again.";
}
export function needsSetup(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    error.response?.data?.error?.code === "WEDDING_REQUIRED"
  );
}
export function signedOut(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
export function weddingDate(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export function directions(wedding: WeddingInput) {
  const destination =
    wedding.latitude !== null && wedding.longitude !== null
      ? wedding.latitude + "," + wedding.longitude
      : wedding.address + ", " + wedding.city;
  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination)
  );
}
export function youtubePlayer(value: string) {
  try {
    const url = new URL(value);
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.split("/").pop();
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        url.hostname,
      ) &&
      /^[\w-]{11}$/.test(id || "")
    )
      return "https://www.youtube-nocookie.com/embed/" + id;
  } catch {
    /* Empty or invalid link: no player. */
  }
  return "";
}
