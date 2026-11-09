import { api, getCsrfHeaders } from "./api";

export const workStatuses = ["To do", "In progress", "Done"] as const;
export type WorkStatus = (typeof workStatuses)[number];
export type FunctionInput = {
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  city: string;
  guestVisible: boolean;
};
export type WeddingFunction = FunctionInput & { id: string };
export type PublicWeddingFunction = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string;
  city: string;
};
type DepartmentDetails = {
  name: string;
  kind: "Family team" | "Outside vendor";
  contactRole: string;
  phone: string;
  deadline: string;
};
export type DepartmentInput = DepartmentDetails & {
  notes: string;
  memberIds: string[];
};
export type Department = DepartmentDetails & {
  id: string;
  status: WorkStatus;
  lastProgressAt: string;
  completed: number;
  total: number;
  attentionReasons: string[];
  hasManualFlag: boolean;
  canEdit: boolean;
  canManage: boolean;
  notes?: string;
  memberIds?: string[];
  checklist?: { id: string; title: string; status: WorkStatus }[];
  updates?: {
    id: string;
    message: string;
    actor: string;
    at: string;
    onBehalf: boolean;
  }[];
};
export type Planning = {
  version: number;
  staleAfterDays: number;
  canManage: boolean;
  functions: WeddingFunction[];
  departments: Department[];
};
export type PlanningChange =
  | { action: "addFunction"; values: FunctionInput }
  | { action: "editFunction"; id: string; values: FunctionInput }
  | { action: "removeFunction"; id: string }
  | { action: "addDepartment"; values: DepartmentInput }
  | { action: "editDepartment"; id: string; values: DepartmentInput }
  | { action: "removeDepartment"; id: string }
  | { action: "applyTemplate" }
  | { action: "updateSettings"; staleAfterDays: number }
  | {
      action: "updateWork";
      id: string;
      status: WorkStatus;
      note: string;
      onBehalf: boolean;
    }
  | { action: "addChecklistItem"; id: string; title: string }
  | {
      action: "updateChecklistItem";
      id: string;
      itemId: string;
      status: WorkStatus;
    }
  | { action: "removeChecklistItem"; id: string; itemId: string }
  | { action: "raiseAttention"; id: string; reason: string }
  | { action: "resolveAttention"; id: string };

export async function getPlanning(signal?: AbortSignal) {
  const response = await api.get<{ data: Planning }>(
    "/weddings/current/planning",
    { signal },
  );
  return response.data.data;
}
export async function changePlanning(change: PlanningChange, version: number) {
  const response = await api.patch<{ data: Planning }>(
    "/weddings/current/planning",
    { ...change, version },
    { headers: await getCsrfHeaders() },
  );
  return response.data.data;
}
export async function getPublicFunctions(
  publicId: string,
  signal?: AbortSignal,
) {
  const response = await api.get<{
    data: PublicWeddingFunction[];
  }>("/public/weddings/" + encodeURIComponent(publicId) + "/functions", {
    signal,
  });
  return response.data.data;
}

export function planningTime(value: string) {
  return (
    new Date(value.length === 16 ? value + ":00+05:30" : value).toLocaleString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      },
    ) + " IST"
  );
}
