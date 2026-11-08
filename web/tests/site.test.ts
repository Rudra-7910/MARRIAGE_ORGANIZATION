import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import axios from "axios";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "../src/lib/api";
import {
  changeAnnouncement,
  getAnnouncements,
  getPublicAnnouncements,
} from "../src/lib/site";
import { AnnouncementsPage } from "../src/features/weddings/AnnouncementsPage";

test("guest update writes preserve the supplied version, audience and CSRF; conflicts are never retried automatically", async (t) => {
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
    const body = raw ? JSON.parse(raw) : null;
    requests.push({
      url: req.url!,
      method: req.method!,
      csrf: req.headers["x-csrf-token"] as string | undefined,
      body,
    });
    res.setHeader("Content-Type", "application/json");
    if (body?.version === 2) {
      res.statusCode = 409;
      res.end(
        JSON.stringify({
          error: {
            code: "SITE_CONFLICT",
            message: "Updates changed. Reload before saving.",
          },
        }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        data: req.url?.endsWith("/csrf")
          ? { token: "site-csrf" }
          : req.url?.startsWith("/api/v1/public/")
            ? []
            : { version: 4, announcements: [] },
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
  assert.equal((await getAnnouncements()).version, 4);
  assert.equal(requests.at(-1)!.url, "/api/v1/weddings/current/announcements");
  const values = {
    title: "Sangeet timing changed",
    text: "Please join us at 7 PM instead of 6 PM.",
    scope: "functions" as const,
    functionIds: ["sangeet"],
    published: false,
  };
  await changeAnnouncement({ action: "edit", id: "update", values }, 3);
  assert.equal(requests.at(-1)!.method, "PATCH");
  assert.equal(requests.at(-1)!.csrf, "site-csrf");
  assert.deepEqual(requests.at(-1)!.body, {
    action: "edit",
    id: "update",
    values,
    version: 3,
  });
  await assert.rejects(
    changeAnnouncement({ action: "remove", id: "update" }, 2),
    (error: unknown) =>
      axios.isAxiosError(error) && error.response?.status === 409,
  );
  assert.equal(
    requests.filter(
      (request) =>
        request.method === "PATCH" &&
        (request.body as { version: number }).version === 2,
    ).length,
    1,
  );
  await getPublicAnnouncements("public/a");
  assert.equal(
    requests.at(-1)!.url,
    "/api/v1/public/weddings/public%2Fa/announcements",
  );
  assert.equal(requests.at(-1)!.csrf, undefined);
});

test("organizer update list distinguishes drafts and function audiences without publishing anything during rendering", () => {
  const client = new QueryClient();
  client.setQueryData(["announcements", "organizer"], {
    version: 5,
    announcements: [
      {
        id: "update",
        title: "Sangeet timing changed",
        text: "Please join us at 7 PM.",
        scope: "functions",
        functionIds: ["sangeet"],
        published: false,
        updatedAt: "2027-04-18T10:00:00Z",
      },
    ],
  });
  client.setQueryData(["planning", "organizer"], {
    version: 2,
    staleAfterDays: 6,
    canManage: true,
    departments: [],
    functions: [{ id: "sangeet", name: "Sangeet" }],
  });
  const html = renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(MemoryRouter, null, h(AnnouncementsPage, { userId: "organizer" })),
    ),
  );
  client.clear();
  assert.ok(html.includes("Sangeet timing changed"));
  assert.ok(html.includes("Draft"));
  assert.ok(html.includes("Not visible to guests."));
  assert.ok(html.includes("For families invited to: Sangeet"));
  assert.ok(html.includes("Write update"));
});
