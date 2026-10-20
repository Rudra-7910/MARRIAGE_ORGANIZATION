import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "auth fails closed on index errors and logout survives rate limits",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("auth_availability_test");
    process.env.SESSION_SECRET =
      "isolated-availability-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    let server: ReturnType<typeof createServer> | undefined;
    t.after(async () => {
      const running = server;
      if (running) {
        running.closeAllConnections();
        await new Promise<void>((resolve) => running.close(() => resolve()));
      }
      await mongoose.disconnect();
      await mongo.stop();
    });

    // Seed a broken legacy database without involving Atlas or application models.
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    await mongoose.connection.collection("users").insertMany([
      {
        name: "Legacy A",
        email: "duplicate@example.com",
        passwordHash: "test-only",
      },
      {
        name: "Legacy B",
        email: "duplicate@example.com",
        passwordHash: "test-only",
      },
    ]);
    await mongoose.disconnect();
    const { connectDatabase, getDatabaseStatus } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    const app = createApp();
    assert.equal(app.get("trust proxy"), false);
    server = createServer(app);
    const running = server;
    await new Promise<void>((resolve) =>
      running.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}/api/v1`;

    await t.test(
      "failed unique index prevents readiness and signup",
      async () => {
        await assert.rejects(connectDatabase());
        assert.equal(getDatabaseStatus(), "initialization_failed");
        assert.equal((await fetch(base + "/health/ready")).status, 503);
        assert.equal((await fetch(base + "/health/live")).status, 200);
        assert.equal((await fetch(base + "/auth/csrf")).status, 503);
        const signup = await fetch(base + "/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Review User",
            email: "duplicate@example.com",
            password: "Review-Disposable-2027",
          }),
        });
        assert.equal(signup.status, 503);
      },
    );

    await t.test(
      "repair and reconnect restores auth with unique email enforcement",
      async () => {
        await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
        await mongoose.connection.collection("users").deleteMany({});
        await mongoose.disconnect();
        await connectDatabase();
        assert.equal((await fetch(base + "/health/ready")).status, 200);
        const indexes = await mongoose.connection.collection("users").indexes();
        assert.ok(
          indexes.some((index) => index.key.email === 1 && index.unique),
        );
      },
    );

    await t.test(
      "signed-in user can fetch CSRF and log out after both IP quotas are exhausted",
      async () => {
        const csrf = await fetch(base + "/auth/csrf");
        const anonymousCookie = csrf.headers.get("set-cookie")!.split(";")[0];
        const token = (await csrf.json()).data.token;
        const values = {
          name: "Availability QA",
          email: "availability@example.com",
          password: "Disposable-Availability-2027",
        };
        const signup = await fetch(base + "/auth/signup", {
          method: "POST",
          headers: {
            Cookie: anonymousCookie,
            Origin: process.env.APP_ORIGIN!,
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
          },
          body: JSON.stringify(values),
        });
        assert.equal(signup.status, 201);
        const cookie = signup.headers.get("set-cookie")!.split(";")[0];
        const userId = (await signup.json()).data.id;
        let status = 0;
        for (let i = 0; i < 121; i++)
          status = (await fetch(base + "/auth/me")).status;
        assert.equal(status, 429);
        for (let i = 0; i < 16; i++)
          status = (await fetch(base + "/auth/login", { method: "POST" }))
            .status;
        assert.equal(status, 429);
        const authenticatedCsrf = await fetch(base + "/auth/csrf", {
          headers: { Cookie: cookie },
        });
        assert.equal(authenticatedCsrf.status, 200);
        const logoutToken = (await authenticatedCsrf.json()).data.token;
        const logout = await fetch(base + "/auth/logout", {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: process.env.APP_ORIGIN!,
            "X-CSRF-Token": logoutToken,
          },
        });
        assert.equal(logout.status, 200);
        assert.match(logout.headers.get("set-cookie") || "", /mmm\.sid=;/);
        assert.equal(
          await mongoose.connection
            .collection("sessions")
            .countDocuments({ session: { $regex: userId } }),
          0,
        );
        const replay = await fetch(base + "/auth/me", {
          headers: { Cookie: cookie },
        });
        assert.notEqual(replay.status, 200);
      },
    );
  },
);
