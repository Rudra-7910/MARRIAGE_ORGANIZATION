import { api, getCsrfHeaders } from "./api";
import type { WeddingRole } from "./weddings";

export type Team = {
  allowedRoles: WeddingRole[];
  members: {
    id: string;
    name: string;
    email?: string;
    role: WeddingRole;
    isCreator: boolean;
    isYou: boolean;
    canRemove: boolean;
  }[];
  invites: {
    id: string;
    role: WeddingRole;
    expiresAt: string;
    status: "pending" | "expired" | "revoked";
    canRevoke: boolean;
  }[];
};
export type TeamInvite = {
  brideName: string;
  groomName: string;
  date: string;
  role: WeddingRole;
  expiresAt: string;
};
export const roleDescriptions: Record<WeddingRole, string> = {
  Admin:
    "Manage the wedding, guest invitations and private budget. Only the wedding creator controls Admin and Organizer membership.",
  Organizer:
    "Manage wedding details, guest invitations and private budget. Invite Managers and Workers.",
  Manager:
    "Help coordinate the wedding team and invite Workers. No access to budget or guest records.",
  Worker:
    "View the wedding workspace and help with coordination. No access to budget, guest records or team invitations.",
};

export async function getTeam(signal?: AbortSignal) {
  const response = await api.get<{ data: Team }>("/weddings/current/team", {
    signal,
  });
  return response.data.data;
}
export async function createTeamInvite(role: WeddingRole) {
  const response = await api.post<{
    data: { id: string; role: WeddingRole; url: string; expiresAt: string };
  }>(
    "/weddings/current/team-invites",
    { role },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function revokeTeamInvite(id: string) {
  await api.delete("/weddings/current/team-invites/" + encodeURIComponent(id), {
    headers: await getCsrfHeaders(),
  });
}
export async function removeTeamMember(id: string) {
  await api.delete("/weddings/current/members/" + encodeURIComponent(id), {
    headers: await getCsrfHeaders(),
  });
}
export async function previewTeamInvite(token: string, signal?: AbortSignal) {
  const response = await api.post<{ data: TeamInvite }>(
    "/team-invites/preview",
    { token },
    { signal },
  );
  return response.data.data;
}
export async function acceptTeamInvite(token: string) {
  const response = await api.post<{ data: { role: WeddingRole } }>(
    "/team-invites/accept",
    { token },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}

// Only this known continuation is allowed; never redirect to a supplied URL.
export function inviteTokenFromState(state: unknown) {
  if (!state || typeof state !== "object" || !("teamInviteToken" in state))
    return "";
  const token = state.teamInviteToken;
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : "";
}
