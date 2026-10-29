import axios from "axios";
import { api, getCsrfHeaders } from "./api";

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
export type WeddingRole = "Admin" | "Organizer" | "Manager" | "Worker";
export type Workspace = {
  family: { id: string; name: string; side: "Bride" | "Groom" | "Both" } | null;
  wedding: WeddingRecord | null;
  role: WeddingRole | null;
};

export function canOrganize(role: WeddingRole | null) {
  return role === "Admin" || role === "Organizer";
}

export async function getSetup() {
  const response = await api.get<{ data: Workspace }>("/setup");
  return response.data.data;
}
export async function getDashboard(signal?: AbortSignal) {
  const response = await api.get<{ data: Workspace }>("/dashboard", { signal });
  return response.data.data;
}
export async function getGuestWedding(publicId: string, signal?: AbortSignal) {
  const response = await api.get<{ data: WeddingDetails }>(
    "/public/weddings/" + encodeURIComponent(publicId),
    { signal },
  );
  return response.data.data;
}
export async function createFamily(values: {
  name: string;
  side: "Bride" | "Groom" | "Both";
}) {
  const response = await api.post<{ data: Workspace }>("/families", values, {
    headers: await getCsrfHeaders(),
  });
  return response.data.data;
}
export async function createWedding(values: WeddingInput) {
  const response = await api.post<{ data: Workspace }>("/weddings", values, {
    headers: await getCsrfHeaders(),
  });
  return response.data.data;
}
export async function editWedding(values: WeddingInput, version: number) {
  const response = await api.patch<{ data: Workspace }>(
    "/weddings/current",
    { ...values, version },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
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
  return new Date(value + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function weddingTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (
    (hours % 12 || 12) +
    ":" +
    String(minutes).padStart(2, "0") +
    (hours >= 12 ? " PM" : " AM")
  );
}

// The wedding form stores Indian local time. Parse it explicitly as IST,
// so a guest opening the website abroad sees the same ceremony and countdown.
export function weddingCountdown(date: string, time: string, now = Date.now()) {
  const target = Date.parse(date + "T" + time + ":00+05:30");
  if (!Number.isFinite(target)) return null;
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    started: target <= now,
  };
}

export const weddingBlessing =
  "ईश्वर की कृपा और अपने बड़ों के आशीर्वाद से, हम अपने जीवन की नई शुरुआत करने जा रहे हैं। इस शुभ विवाह में सपरिवार पधारकर हमें अपने स्नेह और आशीर्वाद से अनुगृहीत करें। आपकी उपस्थिति ही हमारे लिए सबसे सुंदर उपहार है।";
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
