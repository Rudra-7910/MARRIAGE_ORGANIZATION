import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { api } from "../src/lib/api";
import {
  getGuests,
  getInvitation,
  previewInvitation,
  retryInvitation,
  saveGuest,
  sendInvitation,
} from "../src/lib/invitations";

test("invitation Axios requests preserve CSRF, scoped routes, versions and honest outcomes", async (t) => {
  const requests: {
    method: string;
    url: string;
    token: string | undefined;
    body: unknown;
  }[] = [];
  let configured = true;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    requests.push({
      method: req.method!,
      url: req.url!,
      token: req.headers["x-csrf-token"] as string | undefined,
      body: raw ? JSON.parse(raw) : null,
    });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/v1/auth/csrf") {
      res.end(JSON.stringify({ data: { token: "test-invitation-csrf" } }));
    } else if (!configured && req.url?.endsWith("/send")) {
      res.statusCode = 503;
      res.end(
        JSON.stringify({
          error: {
            code: "EMAIL_UNAVAILABLE",
            message: "Configure the sender first.",
          },
        }),
      );
    } else {
      res.end(
        JSON.stringify({
          data: {
            status: "unconfirmed",
            version: 4,
            html: "<p>Saved preview</p>",
          },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  const originalBase = api.defaults.baseURL;
  api.defaults.baseURL = `http://127.0.0.1:${address.port}/api/v1`;
  t.after(async () => {
    api.defaults.baseURL = originalBase;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const root = "/api/v1/weddings/current/guests";
  const guest = {
    name: "Gupta Parivar",
    email: "family@example.com",
    side: "Groom" as const,
  };
  const draft = {
    subject: "Please join us",
    message: "We look forward to celebrating together.",
    version: 3,
    weddingVersion: 2,
  };

  await t.test(
    "reads use current wedding scope and encode search parameters",
    async () => {
      await getGuests({ page: 2, search: "Gupta & family", side: "Groom" });
      const request = requests.at(-1)!;
      const url = new URL(request.url, "http://test.local");
      assert.equal(url.pathname, root);
      assert.equal(url.searchParams.get("search"), "Gupta & family");
      assert.equal(url.searchParams.get("page"), "2");
      await getInvitation("guest-id");
      assert.equal(requests.at(-1)!.url, root + "/guest-id/invitation");
    },
  );
  await t.test(
    "guest writes fetch CSRF and preserve the edit version",
    async () => {
      await saveGuest(guest);
      assert.equal(requests.at(-2)!.url, "/api/v1/auth/csrf");
      assert.deepEqual(requests.at(-1), {
        method: "POST",
        url: root,
        token: "test-invitation-csrf",
        body: guest,
      });
      await saveGuest(guest, {
        ...guest,
        id: "guest-id",
        version: 3,
        status: "not_sent",
        canEdit: true,
        canRetry: false,
        lastAttemptAt: null,
        submittedAt: null,
        error: "",
      });
      assert.deepEqual(requests.at(-1), {
        method: "PATCH",
        url: root + "/guest-id",
        token: "test-invitation-csrf",
        body: { ...guest, version: 3 },
      });
    },
  );
  await t.test(
    "preview, send and retry retain server outcomes without treating them as delivery",
    async () => {
      assert.deepEqual(await previewInvitation("guest-id", draft), {
        status: "unconfirmed",
        version: 4,
        html: "<p>Saved preview</p>",
      });
      assert.equal(requests.at(-1)!.url, root + "/guest-id/preview");
      const result = await sendInvitation("guest-id", draft);
      assert.equal(result.status, "unconfirmed");
      assert.deepEqual(requests.at(-1)!.body, draft);
      await retryInvitation("guest-id", 4);
      assert.deepEqual(requests.at(-1)!.body, { version: 4 });
      for (const request of requests.filter(
        (item) => item.method === "POST" || item.method === "PATCH",
      ))
        assert.equal(request.token, "test-invitation-csrf");
    },
  );
  await t.test(
    "missing-configuration errors reach the page; the client does not fake success or retry",
    async () => {
      configured = false;
      const count = requests.length;
      await assert.rejects(
        sendInvitation("guest-id", draft),
        (error: unknown) => {
          assert.ok(error && typeof error === "object" && "response" in error);
          return true;
        },
      );
      assert.equal(requests.length, count + 2);
      assert.equal(requests.at(-1)!.url, root + "/guest-id/send");
    },
  );
});
