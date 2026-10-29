import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { EmailPayload, SendResult } from "./invitation.email.js";

test(
  "manual invitations: isolated database, real sessions, safe provider outcomes",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("invitation_test");
    process.env.SESSION_SECRET =
      "invitation-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    process.env.RESEND_API_KEY = "test-placeholder-never-used-for-real-mail";
    process.env.RESEND_FROM = "Wedding <invitations@example.com>";
    const { connectDatabase, disconnectDatabase } = await import(
      "../../config/database.js"
    );
    const { createApp } = await import("../../app.js");
    const { env } = await import("../../config/env.js");
    const { Guest } = await import("./invitation.model.js");
    const { Wedding } = await import("../weddings/wedding.models.js");
    const { sendWithResend } = await import("./invitation.email.js");
    const calls: { email: EmailPayload; key: string }[] = [];
    let outcome: SendResult = {
      status: "submitted",
      providerId: "stub-provider-id",
    };
    let gate: Promise<void> | undefined;
    await connectDatabase();
    const server = createServer(
      createApp({
        sendEmail: async (email, key) => {
          calls.push({ email, key });
          if (gate) await gate;
          return outcome;
        },
      }),
    );
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    type Client = { cookie: string; id?: string };
    const owner: Client = { cookie: "" },
      other: Client = { cookie: "" },
      helper: Client = { cookie: "" },
      coOrganizer: Client = { cookie: "" };
    async function request(
      client: Client,
      path: string,
      method = "GET",
      body?: unknown,
      csrf = true,
      origin = process.env.APP_ORIGIN!,
    ) {
      const token: string =
        method !== "GET" && csrf
          ? (await request(client, "/auth/csrf")).body.data.token
          : "";
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: client.cookie,
          Origin: origin,
          "Content-Type": "application/json",
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const cookie = response.headers.get("set-cookie");
      if (cookie) client.cookie = cookie.split(";")[0];
      return { status: response.status, body: await response.json() };
    }
    async function signup(client: Client, email: string) {
      const result = await request(client, "/auth/signup", "POST", {
        name: "Invitation test",
        email,
        password: "Disposable-Test-2027",
      });
      assert.equal(result.status, 201);
      client.id = result.body.data.id;
    }
    const weddingInput = {
      brideName: "Kavya <script>alert(1)</script>",
      groomName: "Arjun",
      date: "2027-03-14",
      startTime: "18:30",
      endTime: "",
      venue: "Family Lawn",
      address: "Gate 2, Civil Lines",
      city: "Jaipur",
      latitude: 26.9124,
      longitude: 75.7873,
      contactRole: "Family coordinator",
      phone: "+919999000000",
      welcome: "Our celebration",
      youtube: "https://youtu.be/abcdefghijk",
    };
    const root = "/weddings/current/guests";
    let weddingId = "";
    let weddingVersion = 0;
    let publicId = "";
    let guestId = "";
    await t.test(
      "anonymous visitors cannot read guest information",
      async () => {
        assert.equal((await request(owner, root)).status, 401);
        await signup(owner, "invitation-owner@example.com");
        assert.equal(
          (await request(owner, root)).body.error.code,
          "WEDDING_REQUIRED",
        );
        await request(owner, "/families", "POST", {
          name: "Test Family",
          side: "Both",
        });
        const wedding = await request(owner, "/weddings", "POST", weddingInput);
        assert.equal(wedding.status, 201);
        publicId = wedding.body.data.wedding.publicId;
        weddingVersion = wedding.body.data.wedding.version;
        const document = await Wedding.findOne({ publicId });
        weddingId = document!.id;
        await signup(other, "other-wedding@example.com");
        await request(other, "/families", "POST", {
          name: "Other Family",
          side: "Bride",
        });
        await request(other, "/weddings", "POST", {
          ...weddingInput,
          brideName: "Other bride",
        });
        await signup(helper, "helper@example.com");
        await signup(coOrganizer, "co-organizer@example.com");
        await Wedding.updateOne(
          { _id: weddingId },
          {
            $push: {
              members: {
                $each: [
                  { userId: helper.id, role: "Worker" },
                  { userId: coOrganizer.id, role: "Organizer" },
                ],
              },
            },
          },
        );
      },
    );
    await t.test(
      "guest writes enforce CSRF, origin and server-controlled wedding membership",
      async () => {
        const values = {
          name: "Gupta Parivar",
          email: " family@example.com ",
          side: "Groom",
        };
        assert.equal(
          (await request(owner, root, "POST", values, false)).status,
          403,
        );
        assert.equal(
          (
            await request(
              owner,
              root,
              "POST",
              values,
              true,
              "https://untrusted.example",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(owner, root, "POST", {
              ...values,
              wedding: weddingId,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(owner, root, "POST", {
              ...values,
              email: "bad-address",
            })
          ).status,
          422,
        );
        const result = await request(owner, root, "POST", values);
        assert.equal(result.status, 201);
        assert.equal(result.body.data.email, "family@example.com");
        assert.equal(result.body.data.status, "not_sent");
        guestId = result.body.data.id;
        assert.equal(
          (await Guest.findById(guestId))!.wedding.toString(),
          weddingId,
        );
      },
    );
    await t.test(
      "workers and managers are denied; a different wedding cannot access guest IDs",
      async () => {
        assert.equal((await request(helper, root)).status, 403);
        assert.equal(
          (await request(helper, root + "/" + guestId + "/invitation")).status,
          403,
        );
        await Wedding.updateOne(
          { _id: weddingId, "members.userId": helper.id },
          { $set: { "members.$.role": "Manager" } },
        );
        assert.equal((await request(helper, root)).status, 403);
        assert.equal(
          (await request(other, root + "/" + guestId + "/invitation")).status,
          404,
        );
        assert.equal(
          (
            await request(other, root + "/" + guestId, "PATCH", {
              name: "Stolen guest",
              email: "bad@example.com",
              side: "Both",
              version: 0,
            })
          ).status,
          404,
        );
        assert.equal(
          (await request(owner, root + "/invalid-id/invitation")).status,
          404,
        );
      },
    );
    await t.test(
      "saved edits use versions; filtered reads are paginated and never expose send snapshots",
      async () => {
        const values = {
          name: "Gupta & Parivar",
          email: "family@example.com",
          side: "Groom",
          version: 0,
        };
        assert.equal(
          (await request(owner, root + "/" + guestId, "PATCH", values)).status,
          200,
        );
        assert.equal(
          (await request(coOrganizer, root + "/" + guestId, "PATCH", values))
            .status,
          409,
        );
        const list = await request(
          owner,
          root + "?search=Gupta&side=Groom&page=1",
        );
        assert.equal(list.body.data.total, 1);
        assert.equal(list.body.data.summary.notSent, 1);
        assert.equal(list.body.data.guests[0].version, 1);
        assert.equal(
          (
            await request(owner, root + "/" + guestId, "PATCH", {
              ...values,
              version: 100,
            })
          ).status,
          409,
        );
        assert.equal(list.body.data.guests[0].invitation, undefined);
        assert.equal((await request(owner, root + "?search=%5B")).status, 200);
        assert.equal((await request(owner, root + "?page=0")).status, 422);
      },
    );
    const draft = {
      subject: "You are invited",
      message: "Namaste! <script>alert('x')</script>\nआपका स्वागत है।",
      version: 1,
      weddingVersion: 0,
    };
    await t.test(
      "the server preview uses real wedding fields, escapes input, and rejects injected email fields",
      async () => {
        const result = await request(
          owner,
          root + "/" + guestId + "/preview",
          "POST",
          draft,
        );
        assert.equal(result.status, 200);
        const html = result.body.data.html;
        assert.ok(html.includes("&lt;script&gt;"));
        assert.ok(!html.includes("<script>"));
        assert.ok(html.includes("Gupta &amp; Parivar"));
        assert.ok(html.includes("14 March 2027 · 18:30 IST"));
        assert.ok(html.includes("26.9124%2C75.7873"));
        assert.ok(html.includes("/w/" + publicId));
        assert.ok(html.includes(weddingInput.youtube));
        assert.ok(!html.includes("ramesh.gupta"));
        assert.equal(
          (
            await request(owner, root + "/" + guestId + "/preview", "POST", {
              ...draft,
              from: "injected@example.com",
            })
          ).status,
          422,
        );
      },
    );
    await t.test(
      "missing Resend configuration never pretends to send",
      async () => {
        const key = env.resendApiKey;
        env.resendApiKey = "";
        try {
          assert.equal(
            (await request(owner, root)).body.data.emailConfigured,
            false,
          );
          assert.equal(
            (
              await request(
                owner,
                root + "/" + guestId + "/send",
                "POST",
                draft,
              )
            ).status,
            503,
          );
          assert.equal(calls.length, 0);
          assert.equal((await Guest.findById(guestId))!.invitation, null);
        } finally {
          env.resendApiKey = key;
        }
      },
    );
    await t.test(
      "concurrent organizers claim one send, with one provider call and a persisted result",
      async () => {
        let release!: () => void;
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const first = request(
          owner,
          root + "/" + guestId + "/send",
          "POST",
          draft,
        );
        // Wait for the injected provider boundary, not a guessed request timing.
        for (let i = 0; calls.length === 0 && i < 100; i++)
          await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(calls.length, 1);
        const second = await request(
          coOrganizer,
          root + "/" + guestId + "/send",
          "POST",
          draft,
        );
        assert.equal(second.status, 409);
        release();
        gate = undefined;
        const result = await first;
        assert.equal(result.status, 200);
        assert.equal(result.body.data.status, "submitted");
        assert.equal(result.body.data.canRetry, false);
        assert.equal(calls.length, 1);
        const saved = await Guest.findById(guestId);
        assert.equal(saved!.invitation!.providerId, "stub-provider-id");
        assert.equal(saved!.invitation!.key, calls[0].key);
        assert.equal(saved!.invitation!.html, calls[0].email.html);
        assert.ok(result.body.data.submittedAt);
        assert.equal(result.body.data.status === "delivered", false);
      },
    );
    await t.test(
      "submitted emails are immutable, retries blocked, and private records stay out of public data",
      async () => {
        const guest = (
          await request(owner, root + "/" + guestId + "/invitation")
        ).body.data.guest;
        assert.equal(
          (
            await request(owner, root + "/" + guestId, "PATCH", {
              name: "Changed",
              email: "new@example.com",
              side: "Both",
              version: guest.version,
            })
          ).body.error.code,
          "INVITATION_LOCKED",
        );
        assert.equal(
          (
            await request(owner, root + "/" + guestId + "/retry", "POST", {
              version: guest.version,
            })
          ).status,
          409,
        );
        const list = await request(owner, root);
        assert.equal(list.body.data.summary.submitted, 1);
        assert.equal(
          JSON.stringify(list.body).includes("wedding-invite/"),
          false,
        );
        const publicPage = await request(
          { cookie: "" },
          "/public/weddings/" + publicId,
        );
        assert.equal(publicPage.status, 200);
        assert.ok(
          !JSON.stringify(publicPage.body).includes("family@example.com"),
        );
        assert.ok(!JSON.stringify(publicPage.body).includes(env.resendApiKey));
      },
    );
    let failedId = "";
    await t.test(
      "a definite rejection can be retried safely or corrected in the directory",
      async () => {
        failedId = (
          await request(coOrganizer, root, "POST", {
            name: "Sharma Parivar",
            email: "sharma@example.com",
            side: "Bride",
          })
        ).body.data.id;
        outcome = { status: "failed", error: "Stub provider rejection" };
        const response = await request(
          coOrganizer,
          root + "/" + failedId + "/send",
          "POST",
          { ...draft, version: 0 },
        );
        assert.equal(response.body.data.status, "failed");
        assert.equal(response.body.data.canRetry, true);
        assert.equal(response.body.data.canEdit, true);
        const firstPayload = calls.at(-1);
        const retried = await request(
          coOrganizer,
          root + "/" + failedId + "/retry",
          "POST",
          { version: response.body.data.version },
        );
        assert.equal(retried.status, 200);
        assert.equal(retried.body.data.status, "failed");
        assert.deepEqual(calls.at(-1), firstPayload);
        const corrected = await request(
          coOrganizer,
          root + "/" + failedId,
          "PATCH",
          {
            name: "Sharma Parivar",
            email: "correct@example.com",
            side: "Bride",
            version: retried.body.data.version,
          },
        );
        assert.equal(corrected.body.data.status, "not_sent");
        assert.equal(corrected.body.data.email, "correct@example.com");
      },
    );
    let unknownId = "";
    await t.test(
      "an ambiguous result retries with the exact frozen payload and provider key",
      async () => {
        unknownId = (
          await request(coOrganizer, root, "POST", {
            name: "Verma Parivar",
            email: "verma@example.com",
            side: "Both",
          })
        ).body.data.id;
        outcome = { status: "unconfirmed", error: "Stub timeout" };
        const result = await request(
          coOrganizer,
          root + "/" + unknownId + "/send",
          "POST",
          { ...draft, version: 0 },
        );
        assert.equal(result.body.data.status, "unconfirmed");
        assert.equal(result.body.data.canEdit, false);
        const before = calls.at(-1)!;
        await Wedding.updateOne(
          { _id: weddingId },
          { $set: { venue: "Updated Wedding Hall" }, $inc: { __v: 1 } },
        );
        weddingVersion++;
        outcome = { status: "submitted", providerId: "retried-provider-id" };
        const retry = await request(
          coOrganizer,
          root + "/" + unknownId + "/retry/",
          "POST",
          { version: result.body.data.version },
        );
        assert.equal(retry.status, 200);
        assert.equal(retry.body.data.status, "submitted");
        assert.deepEqual(calls.at(-1), before);
        assert.ok(!calls.at(-1)!.email.html.includes("Updated Wedding Hall"));
        const freshPreview = await request(
          owner,
          root + "/" + failedId + "/invitation",
        );
        assert.ok(freshPreview.body.data.html.includes("Updated Wedding Hall"));
        assert.equal(freshPreview.body.data.weddingVersion, weddingVersion);
      },
    );
    await t.test(
      "abandoned sends become unconfirmed; expired uncertain attempts cannot generate fresh mail",
      async () => {
        await Guest.updateOne(
          { _id: unknownId },
          {
            $set: {
              "invitation.status": "sending",
              "invitation.leaseUntil": new Date(Date.now() - 1000),
              "invitation.firstAttemptAt": new Date(
                Date.now() - 25 * 60 * 60 * 1000,
              ),
              "invitation.providerId": "",
              "invitation.submittedAt": null,
            },
            $inc: { __v: 1 },
          },
        );
        const result = await request(
          owner,
          root + "/" + unknownId + "/invitation",
        );
        assert.equal(result.body.data.guest.status, "unconfirmed");
        assert.equal(result.body.data.guest.canRetry, false);
        assert.ok(result.body.data.guest.error.includes("expired"));
        const count = calls.length;
        assert.equal(
          (
            await request(owner, root + "/" + unknownId + "/retry", "POST", {
              version: result.body.data.guest.version,
            })
          ).status,
          409,
        );
        assert.equal(calls.length, count);
      },
    );
    await t.test(
      "stale wedding versions cannot send obsolete details",
      async () => {
        const guest = (
          await request(owner, root + "/" + failedId + "/invitation")
        ).body.data.guest;
        assert.equal(
          (
            await request(owner, root + "/" + failedId + "/send", "POST", {
              ...draft,
              version: guest.version,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "Resend transport classifies rejection versus uncertain acceptance without leaking errors",
      async () => {
        const originalFetch = globalThis.fetch;
        const email = calls[0].email;
        try {
          let status = 200;
          let body = JSON.stringify({ id: "provider-message-id" });
          globalThis.fetch = async (url, init) => {
            assert.equal(url, "https://api.resend.com/emails");
            assert.equal(
              (init!.headers as Record<string, string>)["Idempotency-Key"],
              "test-key",
            );
            assert.deepEqual(JSON.parse(init!.body as string).to, [email.to]);
            return new Response(body, { status });
          };
          assert.deepEqual(await sendWithResend(email, "test-key"), {
            status: "submitted",
            providerId: "provider-message-id",
          });
          for (const code of [400, 401, 403, 422, 429]) {
            status = code;
            body = JSON.stringify({ message: "private provider credentials" });
            const result = await sendWithResend(email, "test-key");
            assert.equal(result.status, "failed");
            assert.ok(
              !JSON.stringify(result).includes("private provider credentials"),
            );
          }
          for (const code of [408, 409, 500, 503]) {
            status = code;
            assert.equal(
              (await sendWithResend(email, "test-key")).status,
              "unconfirmed",
            );
          }
          status = 200;
          body = "{}";
          assert.equal(
            (await sendWithResend(email, "test-key")).status,
            "unconfirmed",
          );
          globalThis.fetch = async () => {
            throw new Error("private socket error");
          };
          assert.equal(
            (await sendWithResend(email, "test-key")).status,
            "unconfirmed",
          );
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    );
  },
);
