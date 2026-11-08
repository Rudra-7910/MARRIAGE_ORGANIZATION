import { api, getCsrfHeaders } from "./api";

export type AnnouncementInput = {
  title: string;
  text: string;
  scope: "public" | "functions";
  functionIds: string[];
  published: boolean;
};
export type Announcement = AnnouncementInput & {
  id: string;
  updatedAt: string;
};
export type AnnouncementPage = {
  version: number;
  announcements: Announcement[];
};
export type AnnouncementChange =
  | { action: "add"; values: AnnouncementInput }
  | { action: "edit"; id: string; values: AnnouncementInput }
  | { action: "remove"; id: string };

export async function getAnnouncements(signal?: AbortSignal) {
  const response = await api.get<{ data: AnnouncementPage }>(
    "/weddings/current/announcements",
    { signal },
  );
  return response.data.data;
}
export async function changeAnnouncement(
  change: AnnouncementChange,
  version: number,
) {
  const response = await api.patch<{ data: AnnouncementPage }>(
    "/weddings/current/announcements",
    {
      ...change,
      version,
    },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function getPublicAnnouncements(
  publicId: string,
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: Announcement[] }>(
    "/public/weddings/" + encodeURIComponent(publicId) + "/announcements",
    { signal },
  );
  return response.data.data;
}
