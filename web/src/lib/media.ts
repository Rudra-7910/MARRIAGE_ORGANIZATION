import axios from "axios";
import { api, getCsrfHeaders } from "./api";

export type Photo = {
  id: string;
  name: string;
  state: "uploading" | "verifying" | "pending" | "approved" | "rejected";
  bytes: number;
  width: number;
  height: number;
  createdAt: string;
  version: number;
  url?: string;
};
export type UploadGrant = {
  id: string;
  url: string;
  expiresAt: string;
  limit: number;
  used: number;
  revoked: boolean;
  qrDataUrl?: string;
};
export type PhotoState = "pending" | "approved" | "rejected";
export type PhotoPage = {
  photos: Photo[];
  page: number;
  total: number;
  pageSize: number;
  canModerate: boolean;
  configured: boolean;
  grants: UploadGrant[];
};
export type PublicPhoto = {
  id: string;
  name: string;
  width: number;
  height: number;
  url: string;
  downloadUrl: string;
};
export type PublicPhotoPage = {
  photos: PublicPhoto[];
  page: number;
  total: number;
  pageSize: number;
};
export type UploadInfo = {
  brideName: string;
  groomName: string;
  expiresAt: string;
  remaining: number;
  maxBytes: number;
  configured: boolean;
};
export type AuthorizedUpload = {
  id: string;
  uploadUrl: string;
  headers: Record<string, string>;
};

export async function getPhotos(
  state: PhotoState,
  page: number,
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: PhotoPage }>(
    "/weddings/current/photos",
    {
      params: { state, page },
      signal,
    },
  );
  return response.data.data;
}
export async function createUploadLink(values: {
  days: number;
  limit: number;
}) {
  const response = await api.post<{ data: UploadGrant }>(
    "/weddings/current/upload-links",
    values,
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function revokeUploadLink(id: string) {
  await api.delete("/weddings/current/upload-links/" + encodeURIComponent(id), {
    headers: await getCsrfHeaders(),
  });
}
export async function moderatePhoto(
  id: string,
  action: "approve" | "reject" | "unpublish",
  version: number,
) {
  const response = await api.patch<{ data: Photo }>(
    "/weddings/current/photos/" + encodeURIComponent(id),
    { action, version },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function getPublicPhotos(
  publicId: string,
  page: number,
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: PublicPhotoPage }>(
    "/public/weddings/" + encodeURIComponent(publicId) + "/photos",
    {
      params: { page },
      signal,
    },
  );
  return response.data.data;
}
export async function getUploadInfo(
  publicId: string,
  token: string,
  signal?: AbortSignal,
) {
  const response = await api.post<{ data: UploadInfo }>(
    "/uploads/info",
    { publicId, token },
    { signal },
  );
  return response.data.data;
}
export async function authorizeUpload(
  publicId: string,
  token: string,
  file: File,
  signal?: AbortSignal,
) {
  const response = await api.post<{ data: AuthorizedUpload }>(
    "/uploads/authorize",
    {
      publicId,
      token,
      name: file.name,
      type: file.type,
      size: file.size,
    },
    { signal },
  );
  return response.data.data;
}
// Renew the same upload reservation when a connection failed or the signed URL expired.
export async function renewUpload(
  publicId: string,
  token: string,
  id: string,
  signal?: AbortSignal,
) {
  const response = await api.post<{ data: AuthorizedUpload }>(
    "/uploads/" + encodeURIComponent(id) + "/authorize",
    { publicId, token },
    { signal },
  );
  return response.data.data;
}
// The signed storage URL is a separate request. Never attach our session or CSRF headers.
export async function putPhoto(
  upload: AuthorizedUpload,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) {
  await axios.put(upload.uploadUrl, file, {
    headers: upload.headers,
    withCredentials: false,
    withXSRFToken: false,
    timeout: 120000,
    signal,
    onUploadProgress: (event) => {
      const total = event.total || file.size;
      if (total)
        onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
    },
  });
}
export async function completeUpload(
  publicId: string,
  token: string,
  id: string,
  signal?: AbortSignal,
) {
  const response = await api.post<{ data: { state: "pending" } }>(
    "/uploads/" + encodeURIComponent(id) + "/complete",
    { publicId, token },
    { signal },
  );
  return response.data.data;
}

export async function getUploadLink(id: string, signal?: AbortSignal) {
  const response = await api.get<{ data: UploadGrant }>(
    "/weddings/current/upload-links/" + encodeURIComponent(id),
    { signal },
  );
  return response.data.data;
}
