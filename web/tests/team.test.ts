import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../src/lib/api";
import {
  acceptTeamInvite,
  createTeamInvite,
  getTeam,
  inviteTokenFromState,
  previewTeamInvite,
  removeTeamMember,
  revokeTeamInvite,
} from "../src/lib/team";
import { DashboardLayout } from "../src/features/weddings/DashboardLayout";
import { AccountRoutes } from "../src/features/weddings/WeddingApp";
import { TeamInvitePage } from "../src/features/weddings/TeamInvitePage";
import type { Workspace, WeddingRole } from "../src/lib/weddings";

test("team invitation client sends tokens in JSON and protects every access mutation with CSRF", async (t) => {
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
          ? { token: "test-team-csrf" }
          : { role: "Worker" },
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
  const token = "a".repeat(64);
  await previewTeamInvite(token);
  assert.equal(requests.at(-1)!.url, "/api/v1/team-invites/preview");
  assert.deepEqual(requests.at(-1)!.body, { token });
  await createTeamInvite("Worker");
  assert.deepEqual(requests.at(-1)!.body, { role: "Worker" });
  const accepted = await acceptTeamInvite(token);
  assert.equal(accepted.role, "Worker");
  assert.deepEqual(requests.at(-1)!.body, { token });
  await removeTeamMember("member-id");
  await revokeTeamInvite("invite-id");
  await getTeam();
  assert.equal(requests.at(-1)!.url, "/api/v1/weddings/current/team");
  for (const request of requests) {
    assert.ok(!request.url.includes(token));
    if (
      request.method === "DELETE" ||
      (request.method === "POST" && !request.url.endsWith("/preview"))
    )
      assert.equal(request.csrf, "test-team-csrf");
  }
});

test("login continuation accepts only a valid invitation token, never a supplied redirect URL", () => {
  const token = "b".repeat(64);
  assert.equal(inviteTokenFromState({ teamInviteToken: token }), token);
  for (const state of [
    null,
    {},
    { next: "https://untrusted.example" },
    { teamInviteToken: "https://untrusted.example" },
    { teamInviteToken: 123 },
    { teamInviteToken: token + "/Admin" },
  ])
    assert.equal(inviteTokenFromState(state), "");
});

const user = {
  id: "render-user",
  name: "Family member",
  email: "self@example.com",
};
const wedding = {
  publicId: "role-render-wedding",
  brideName: "Meera",
  groomName: "Kabir",
  date: "2027-04-18",
  startTime: "18:00",
  endTime: "",
  venue: "Family Garden",
  address: "Gate 3, Green Road",
  city: "Lucknow",
  latitude: null,
  longitude: null,
  contactRole: "Family coordinator",
  phone: "+919999000000",
  welcome: "",
  youtube: "",
  version: 0,
  updatedAt: "2026-10-29T10:00:00Z",
};
const family = { id: "family", name: "Our family", side: "Both" as const };
function render(role: WeddingRole, route: string, layoutOnly = false) {
  const client = new QueryClient();
  const data: Workspace = { family, wedding, role };
  client.setQueryData(["wedding-dashboard", user.id], data);
  const content = layoutOnly
    ? h(DashboardLayout, {
        user,
        data,
        children: h("p", null, "Member workspace"),
      })
    : h(
        Routes,
        null,
        h(Route, { path: "/app/*", element: h(AccountRoutes, { user }) }),
      );
  const html = renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(MemoryRouter, { initialEntries: [route] }, content),
    ),
  );
  client.clear();
  return html;
}
test("Workers and Managers have no budget navigation and cannot render the budget through a direct route", () => {
  for (const role of ["Worker", "Manager"] as const) {
    const menu = render(role, "/app/overview", true);
    assert.ok(!menu.includes('href="/app/budget"'));
    assert.ok(!menu.includes('href="/app/guests"'));
    const page = render(role, "/app/budget");
    assert.ok(!page.includes("Wedding budget"));
    assert.ok(!page.includes("Pending dues"));
  }
  for (const role of ["Admin", "Organizer"] as const) {
    assert.ok(
      render(role, "/app/overview", true).includes('href="/app/budget"'),
    );
    assert.ok(render(role, "/app/budget").includes("Wedding budget"));
  }
});

test("the invitation page explains the exact server-saved role and requires an explicit authenticated acceptance", () => {
  const token = "c".repeat(64);
  const client = new QueryClient();
  client.setQueryData(["auth-user"], null);
  client.setQueryData(["team-invite-preview", token], {
    brideName: "Meera",
    groomName: "Kabir",
    date: wedding.date,
    role: "Worker",
    expiresAt: "2027-04-10T12:00:00Z",
  });
  const html = renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(
        MemoryRouter,
        { initialEntries: ["/team-invites#" + token] },
        h(TeamInvitePage),
      ),
    ),
  );
  assert.ok(html.includes("Worker access"));
  assert.ok(html.includes("No access to budget"));
  assert.ok(html.includes('href="/login"'));
  assert.ok(html.includes('href="/signup"'));
  assert.ok(!html.includes("Accept &amp; join as Worker"));
  assert.ok(!html.includes(token));
  client.clear();
});
