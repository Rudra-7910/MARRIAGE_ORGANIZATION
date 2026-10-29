import { api, getCsrfHeaders } from "./api";

export type GuestInput = {
  name: string;
  email: string;
  side: "Bride" | "Groom" | "Both";
};
export type GuestRecord = GuestInput & {
  id: string;
  version: number;
  status: "not_sent" | "sending" | "submitted" | "failed" | "unconfirmed";
  canEdit: boolean;
  canRetry: boolean;
  lastAttemptAt: string | null;
  submittedAt: string | null;
  error: string;
};
export type GuestList = {
  guests: GuestRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total: number;
    submitted: number;
    attention: number;
    notSent: number;
  };
  emailConfigured: boolean;
};
export type InvitationDraft = {
  guest: GuestRecord;
  subject: string;
  message: string;
  html: string;
  weddingVersion: number;
  emailConfigured: boolean;
};
export type EmailInput = {
  version: number;
  weddingVersion: number;
  subject: string;
  message: string;
};
const path = "/weddings/current/guests";
export async function getGuests(
  params: {
    page: number;
    search: string;
    side: string;
  },
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: GuestList }>(path, { params, signal });
  return response.data.data;
}
export async function saveGuest(values: GuestInput, guest?: GuestRecord) {
  const config = { headers: await getCsrfHeaders() };
  if (guest) {
    const response = await api.patch<{ data: GuestRecord }>(
      path + "/" + guest.id,
      { ...values, version: guest.version },
      config,
    );
    return response.data.data;
  }
  const response = await api.post<{ data: GuestRecord }>(path, values, config);
  return response.data.data;
}
export async function getInvitation(id: string) {
  const response = await api.get<{ data: InvitationDraft }>(
    path + "/" + encodeURIComponent(id) + "/invitation",
  );
  return response.data.data;
}
export async function previewInvitation(id: string, values: EmailInput) {
  const response = await api.post<{ data: { html: string } }>(
    path + "/" + id + "/preview",
    values,
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function sendInvitation(id: string, values: EmailInput) {
  const response = await api.post<{ data: GuestRecord }>(
    path + "/" + id + "/send",
    values,
    {
      headers: await getCsrfHeaders(),
      timeout: 30000,
    },
  );
  return response.data.data;
}
export async function retryInvitation(id: string, version: number) {
  const response = await api.post<{ data: GuestRecord }>(
    path + "/" + id + "/retry",
    { version },
    { headers: await getCsrfHeaders(), timeout: 30000 },
  );
  return response.data.data;
}
export const invitationLabels: Record<GuestRecord["status"], string> = {
  not_sent: "Not sent",
  sending: "Submitting",
  submitted: "Submitted",
  failed: "Failed",
  unconfirmed: "Unconfirmed",
};
