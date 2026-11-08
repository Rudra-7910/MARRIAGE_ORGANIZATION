import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as connectSocket } from "socket.io-client";

test(
  "password recovery consumes tokens once and revokes HTTP/socket sessions",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    Object.assign(process.env, {
      NODE_ENV: "test",
      MONGODB_URI: mongo.getUri("recovery_test"),
      SESSION_SECRET:
        "isolated-password-recovery-session-secret-at-least-32-characters",
      APP_ORIGIN: "http://127.0.0.1:3000",
      RESEND_API_KEY: "test-only-not-a-real-key",
      RESEND_FROM: "Wedding <test@example.com>",
      TRUST_PROXY_CIDRS: "",
    });
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    const { attachRealtime } = await import("../../config/realtime.js");
    const { User } = await import("./user.model.js");
    const { Family, Wedding } = await import("../weddings/wedding.models.js");
    const emails: { html: string; text: string; to: string; key: string }[] =
      [];
    const app = createApp({
      sendEmail: async (email, key) => {
        emails.push({ ...email, key });
        return { status: "submitted", providerId: "test-message" };
      },
    });
    await connectDatabase();
    const server = createServer(app);
    const sockets = attachRealtime(server, app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    t.after(async () => {
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      server.closeAllConnections();
      await disconnectDatabase();
      await mongo.stop();
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing port");
    const base = "http://127.0.0.1:" + address.port;
    const owner = { cookie: "" },
      anonymous = { cookie: "" },
      second = { cookie: "" };
    async function request(
      client: { cookie: string },
      path: string,
      values?: unknown,
      csrf = true,
    ) {
      let token = "";
      if (values !== undefined && csrf) {
        const initial = await request(client, "/csrf");
        token = initial.body.data.token;
      }
      const result = await fetch(base + "/api/v1/auth" + path, {
        method: values === undefined ? "GET" : "POST",
        headers: {
          Cookie: client.cookie,
          Origin: process.env.APP_ORIGIN!,
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: values === undefined ? undefined : JSON.stringify(values),
      });
      if (result.headers.get("set-cookie"))
        client.cookie = result.headers.get("set-cookie")!.split(";")[0]!;
      return { status: result.status, body: await result.json() };
    }
    const password = "Disposable-Old-Password-2026";
    const newPassword = "Disposable-New-Password-2026";
    const email = "recover@example.com";
    const registered = await request(owner, "/signup", {
      name: "Recovery QA",
      email,
      password,
    });
    assert.equal(registered.status, 201);
    const userId = registered.body.data.id;
    const family = await Family.create({
      owner: userId,
      name: "Our family",
      side: "Both",
    });
    await Wedding.create({
      family: family._id,
      createdBy: userId,
      brideName: "Meera",
      groomName: "Kabir",
      date: "2027-04-18",
      startTime: "19:00",
      venue: "Family Garden",
      address: "Gate 2, Civil Lines",
      city: "Jaipur",
      contactRole: "Organizer",
      phone: "+919999000000",
      members: [{ userId, role: "Admin" }],
    });
    let token = "";
    await t.test(
      "known/unknown accounts receive the same safe response; the cooldown prevents duplicate mail",
      async () => {
        const unknown = await request(anonymous, "/forgot-password", {
          email: "unknown@example.com",
        });
        const known = await request(anonymous, "/forgot-password", { email });
        assert.equal(known.status, 200);
        assert.deepEqual(known.body, unknown.body);
        assert.equal(emails.length, 1);
        assert.equal(emails[0]!.to, email);
        token = emails[0]!.text.match(/reset-password#([a-f0-9]{64})/)![1]!;
        const stored = await User.findById(userId).select(
          "+resetTokenHash +resetExpiresAt",
        );
        assert.equal(
          stored!.resetTokenHash,
          createHash("sha256").update(token).digest("hex"),
        );
        assert.equal(
          (await User.findById(userId).lean())!.resetTokenHash,
          undefined,
        );
        assert.ok(stored!.resetExpiresAt!.getTime() > Date.now());
        await request(anonymous, "/forgot-password", { email });
        assert.equal(emails.length, 1);
      },
    );
    await t.test(
      "concurrent consumers produce one success; existing HTTP and socket access is revoked",
      async () => {
        const socket = connectSocket(base, {
          transports: ["websocket"],
          extraHeaders: {
            Cookie: owner.cookie,
            Origin: process.env.APP_ORIGIN!,
          },
          reconnection: false,
        });
        t.after(() => socket.disconnect());
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Socket did not connect")),
            5000,
          );
          socket.once("connect", () => {
            clearTimeout(timer);
            resolve();
          });
          socket.once("connect_error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
        });
        const disconnected = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Reset did not disconnect socket")),
            5000,
          );
          socket.once("disconnect", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        const results = await Promise.all([
          request(anonymous, "/reset-password", {
            token,
            password: newPassword,
          }),
          request(second, "/reset-password", { token, password: newPassword }),
        ]);
        assert.deepEqual(results.map((item) => item.status).sort(), [200, 400]);
        await disconnected;
        assert.equal((await request(owner, "/me")).status, 401);
        assert.equal((await request(anonymous, "/me")).status, 401);
        assert.equal(
          (
            await request(anonymous, "/reset-password", {
              token,
              password: newPassword,
            })
          ).status,
          400,
        );
        assert.equal(
          (await request(owner, "/login", { email, password })).status,
          401,
        );
        assert.equal(
          (await request(owner, "/login", { email, password: newPassword }))
            .status,
          200,
        );
        assert.equal((await request(owner, "/me")).body.data.id, userId);
      },
    );
    await t.test(
      "expired tokens and missing CSRF never change the password",
      async () => {
        await User.updateOne(
          { _id: userId },
          { $set: { resetRequestedAt: new Date(0) } },
        );
        await request(anonymous, "/forgot-password", { email });
        const expired = emails
          .at(-1)!
          .text.match(/reset-password#([a-f0-9]{64})/)![1]!;
        await User.updateOne(
          { _id: userId },
          { $set: { resetExpiresAt: new Date(0) } },
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/reset-password",
              { token: expired, password },
              false,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(anonymous, "/reset-password", {
              token: expired,
              password,
            })
          ).status,
          400,
        );
        assert.equal((await request(owner, "/me")).status, 200);
      },
    );
  },
);
