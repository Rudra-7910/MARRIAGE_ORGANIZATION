import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "../src/lib/api";
import {
  changePlanning,
  getPlanning,
  getPublicFunctions,
  planningTime,
} from "../src/lib/planning";
import type { Planning } from "../src/lib/planning";
import { FunctionsPage } from "../src/features/weddings/FunctionsPage";
import { TeamsPage } from "../src/features/weddings/TeamsPage";
import type { Workspace } from "../src/lib/weddings";

test("planning client keeps command versions, CSRF and public reads separate", async (t) => {
  const requests: {
    url: string;
    method: string;
    csrf?: string;
    body: unknown;
  }[] = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    requests.push({
      url: req.url!,
      method: req.method!,
      csrf: req.headers["x-csrf-token"] as string | undefined,
      body: raw ? JSON.parse(raw) : null,
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        data: req.url?.endsWith("/csrf")
          ? { token: "planning-csrf" }
          : { version: 4, departments: [], functions: [] },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  const previous = api.defaults.baseURL;
  api.defaults.baseURL = "http://127.0.0.1:" + address.port + "/api/v1";
  t.after(async () => {
    api.defaults.baseURL = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await getPlanning();
  assert.equal(requests.at(-1)!.url, "/api/v1/weddings/current/planning");
  await changePlanning(
    {
      action: "updateChecklistItem",
      id: "department",
      itemId: "task",
      status: "Done",
    },
    3,
  );
  assert.equal(requests.at(-1)!.method, "PATCH");
  assert.equal(requests.at(-1)!.csrf, "planning-csrf");
  assert.deepEqual(requests.at(-1)!.body, {
    action: "updateChecklistItem",
    id: "department",
    itemId: "task",
    status: "Done",
    version: 3,
  });
  await getPublicFunctions("a/b");
  assert.equal(requests.at(-1)!.url, "/api/v1/public/weddings/a%2Fb/functions");
  assert.equal(requests.at(-1)!.csrf, undefined);
});
const planning: Planning = {
  version: 0,
  canManage: false,
  staleAfterDays: 6,
  functions: [],
  departments: [],
};
const data: Workspace = {
  family: null,
  role: "Worker",
  wedding: {
    brideName: "Meera",
    groomName: "Kabir",
    date: "2027-04-18",
    startTime: "18:00",
    endTime: "23:00",
    venue: "Family Garden",
    address: "Gate 2, Civil Lines",
    city: "Jaipur",
    latitude: null,
    longitude: null,
    contactRole: "Family coordinator",
    phone: "+919999000000",
    welcome: "",
    youtube: "",
    publicId: "test-public-wedding",
    version: 0,
    updatedAt: "2026-11-03T10:00:00Z",
  },
};
function render(content: ReturnType<typeof h>, values: Planning) {
  const client = new QueryClient();
  client.setQueryData(["planning", "render-user"], values);
  const html = renderToStaticMarkup(
    h(QueryClientProvider, { client }, h(MemoryRouter, null, content)),
  );
  client.clear();
  return html;
}
test("worker planning pages offer progress without organizer management controls", () => {
  const functions = render(
    h(FunctionsPage, { data, userId: "render-user" }),
    planning,
  );
  assert.ok(functions.includes("Functions &amp; ceremonies"));
  assert.ok(functions.includes("Family Garden"));
  assert.ok(!functions.includes("Add function"));
  const teams = render(h(TeamsPage, { userId: "render-user" }), planning);
  assert.ok(teams.includes("Teams &amp; Services"));
  assert.ok(!teams.includes("Add department"));
  assert.ok(!teams.includes("Start with the wedding checklist"));
  const attention = render(
    h(TeamsPage, { userId: "render-user", attentionOnly: true }),
    planning,
  );
  assert.ok(attention.includes("Need Your Attention"));
  assert.ok(!attention.includes("Save interval"));
});
test("organizers get blank creation actions instead of seeded planning records", () => {
  const values = { ...planning, canManage: true };
  const html = render(
    h(FunctionsPage, {
      data: { ...data, role: "Admin" },
      userId: "render-user",
    }),
    values,
  );
  assert.ok(html.includes("Add function"));
  assert.ok(html.includes("0 additional functions"));
  const teams = render(h(TeamsPage, { userId: "render-user" }), values);
  assert.ok(teams.includes("Add department"));
  assert.ok(teams.includes("Start with the wedding checklist"));
  assert.ok(!teams.includes("Sharma Caterers"));
});
test("function times are formatted in IST independently of the viewer's timezone", () => {
  assert.equal(
    planningTime("2027-04-17T16:00"),
    planningTime("2027-04-17T10:30:00.000Z"),
  );
  assert.ok(planningTime("2027-04-17T16:00").endsWith("IST"));
});
