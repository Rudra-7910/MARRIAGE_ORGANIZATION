import { api, getCsrfHeaders } from "./api";

export const providerCategories = [
  { id: "catering", name: "Catering" },
  { id: "photography", name: "Photography" },
  { id: "decoration", name: "Decoration" },
  { id: "lighting", name: "Lighting" },
  { id: "tent", name: "Tent & Mandap" },
  { id: "music", name: "Music & Rituals" },
] as const;
type ProviderCategory = (typeof providerCategories)[number]["id"];
export type ProviderInput = {
  name: string;
  category: ProviderCategory;
  description: string;
  phone: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  googlePlaceId?: string;
  serviceRadiusKm: number;
  availability: string;
  portfolioUrls: string[];
  published: boolean;
};
export type Provider = ProviderInput & {
  id: string;
  ownerId: string;
  version: number;
  averageRating: number;
  reviewCount: number;
  distanceKm?: number;
  createdAt: string;
  hidden?: boolean;
  moderationReason?: string;
};
export type Review = {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
  version: number;
  canEdit: boolean;
  hidden?: boolean;
  moderationReason?: string;
};
export type ProviderDetails = {
  provider: Provider;
  reviews: Review[];
  canReview: {
    departmentId: string;
    departmentName: string;
    weddingId: string;
  }[];
  canModerate: boolean;
};
export type ProviderDirectory = {
  providers: Provider[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getProviders(
  filters: {
    latitude?: number;
    longitude?: number;
    category: string;
    sort: string;
    page: number;
    search: string;
  },
  signal?: AbortSignal,
) {
  const response = await api.get<{ data: ProviderDirectory }>("/providers", {
    params: filters,
    signal,
  });
  return response.data.data;
}
export async function getProvider(id: string, signal?: AbortSignal) {
  const response = await api.get<{ data: ProviderDetails }>(
    "/providers/" + encodeURIComponent(id),
    { signal },
  );
  return response.data.data;
}
export async function getMyProvider(signal?: AbortSignal) {
  const response = await api.get<{
    data: { profile: Provider | null; canModerate: boolean };
  }>("/providers/me", { signal });
  return response.data.data;
}
export async function saveProvider(
  values: ProviderInput & { version: number },
) {
  const response = await api.put<{ data: { profile: Provider } }>(
    "/providers/me",
    values,
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function addProviderToWedding(id: string) {
  const response = await api.post<{ data: { departmentId: string } }>(
    "/providers/" + encodeURIComponent(id) + "/add-to-wedding",
    {},
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function createProviderReview(
  id: string,
  values: { departmentId: string; rating: number; text: string },
) {
  await api.post("/providers/" + encodeURIComponent(id) + "/reviews", values, {
    headers: await getCsrfHeaders(),
  });
}
export async function updateProviderReview(
  id: string,
  reviewId: string,
  values: { version: number; rating: number; text: string },
) {
  await api.patch(
    "/providers/" +
      encodeURIComponent(id) +
      "/reviews/" +
      encodeURIComponent(reviewId),
    values,
    { headers: await getCsrfHeaders() },
  );
}
export async function getProviderModeration(signal?: AbortSignal) {
  const response = await api.get<{
    data: { providers: Provider[]; reviews: Review[] };
  }>("/moderation", { signal });
  return response.data.data;
}
export async function moderateProviderContent(
  kind: "providers" | "reviews",
  id: string,
  values: { hidden: boolean; reason: string },
) {
  await api.patch(
    "/moderation/" + kind + "/" + encodeURIComponent(id),
    values,
    { headers: await getCsrfHeaders() },
  );
}
