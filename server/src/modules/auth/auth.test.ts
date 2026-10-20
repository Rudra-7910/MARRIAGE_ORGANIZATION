import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "session authentication against an isolated MongoDB",
  { timeout: 120000 },
  async (t) => {
    // This disposable database is used only by tests, never as an application fallback.
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("mmm_auth_test");
    process.env.SESSION_SECRET =
      "isolated-test-session-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    const { User } = await import("./user.model.js");
    await connectDatabase();
    const server = createServer(createApp());
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}/api/v1/auth`;
    let cookie = "";
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      token?: string,
      origin = process.env.APP_ORIGIN,
    ) {
      const headers: Record<string, string> = { Origin: origin! };
      if (cookie) headers.Cookie = cookie;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token) headers["X-CSRF-Token"] = token;
      const response = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      return { response, body: await response.json() };
    }
    async function token() {
      return (await request("/csrf")).body.data.token as string;
    }
    const values = {
      name: "Riya Sharma",
      email: "Riya@Example.com",
      password: "Testing-only-1234",
    };
    let anonymousCookie = "";
    await t.test("anonymous requests cannot read an account", async () => {
      assert.equal((await request("/me")).response.status, 401);
    });
    await t.test(
      "CSRF cookie is HttpOnly and SameSite, cross-origin and invalid tokens rejected",
      async () => {
        const csrf = await request("/csrf");
        assert.match(
          csrf.response.headers.get("set-cookie") || "",
          /HttpOnly/i,
        );
        assert.match(
          csrf.response.headers.get("set-cookie") || "",
          /SameSite=Lax/i,
        );
        anonymousCookie = cookie;
        assert.equal(
          (await request("/signup", "POST", values)).response.status,
          403,
        );
        assert.equal(
          (
            await request(
              "/signup",
              "POST",
              values,
              csrf.body.data.token,
              "https://other.example",
            )
          ).response.status,
          403,
        );
        assert.equal(
          (await request("/signup", "POST", values, "é".repeat(64))).response
            .status,
          403,
        );
      },
    );
    let userId = "";
    await t.test(
      "signup hashes the password, rotates the session and ignores supplied roles",
      async () => {
        const result = await request(
          "/signup",
          "POST",
          { ...values, role: "Organizer" },
          await token(),
        );
        assert.equal(result.response.status, 201);
        assert.equal(result.body.data.email, "riya@example.com");
        assert.equal(result.body.data.passwordHash, undefined);
        assert.equal(result.body.data.role, undefined);
        assert.notEqual(cookie, anonymousCookie);
        userId = result.body.data.id;
        const stored = await User.findById(userId)
          .select("+passwordHash")
          .lean();
        assert.ok(stored);
        assert.notEqual(stored.passwordHash, values.password);
        assert.match(stored.passwordHash, /^\$2[aby]\$/);
        assert.equal((await request("/me")).body.data.id, userId);
      },
    );
    await t.test(
      "duplicate email and invalid signup input are rejected",
      async () => {
        assert.equal(
          (await request("/signup", "POST", values, await token())).response
            .status,
          409,
        );
        assert.equal(
          (
            await request(
              "/signup",
              "POST",
              { ...values, email: "bad" },
              await token(),
            )
          ).response.status,
          422,
        );
        assert.equal(
          (
            await request(
              "/signup",
              "POST",
              { ...values, password: "🙂".repeat(20) },
              await token(),
            )
          ).response.status,
          422,
        );
      },
    );
    await t.test(
      "model hashes password changes without rehashing profile edits",
      async () => {
        const bcrypt = (await import("bcryptjs")).default;
        const user = await User.findById(userId).select("+passwordHash");
        assert.ok(user);
        const existingHash = user.passwordHash;
        user.name = "Riya Updated";
        await user.save();
        assert.equal(user.passwordHash, existingHash);
        user.passwordHash = "Changed-Password-2027";
        await user.save();
        assert.notEqual(user.passwordHash, "Changed-Password-2027");
        assert.equal(
          await bcrypt.compare("Changed-Password-2027", user.passwordHash),
          true,
        );
        user.passwordHash = values.password;
        await user.save();
      },
    );
    await t.test(
      "localhost alias works locally but other ports and lookalike hosts are rejected",
      async () => {
        assert.equal(
          (
            await request(
              "/logout",
              "POST",
              {},
              await token(),
              "http://localhost:3000",
            )
          ).response.status,
          200,
        );
        cookie = "";
        assert.equal(
          (
            await request(
              "/login",
              "POST",
              { email: values.email, password: values.password },
              await token(),
              "http://localhost:3000",
            )
          ).response.status,
          200,
        );
        for (const origin of [
          "http://localhost:3002",
          "https://localhost:3000",
          "http://localhost.evil.example:3000",
        ]) {
          assert.equal(
            (await request("/logout", "POST", {}, await token(), origin))
              .response.status,
            403,
          );
        }
      },
    );
    let oldCookie = "";
    await t.test(
      "logout destroys the persisted session; its old cookie no longer authenticates",
      async () => {
        oldCookie = cookie;
        assert.equal(
          (await request("/logout", "POST", {}, await token())).response.status,
          200,
        );
        cookie = oldCookie;
        assert.equal((await request("/me")).response.status, 401);
      },
    );
    await t.test(
      "wrong credentials fail consistently, valid login restores the account",
      async () => {
        cookie = "";
        const wrong = await request(
          "/login",
          "POST",
          { email: values.email, password: "incorrect" },
          await token(),
        );
        const unknown = await request(
          "/login",
          "POST",
          { email: "unknown@example.com", password: "incorrect" },
          await token(),
        );
        assert.equal(wrong.response.status, 401);
        assert.equal(unknown.body.error.message, wrong.body.error.message);
        const result = await request(
          "/login",
          "POST",
          { email: values.email, password: values.password },
          await token(),
        );
        assert.equal(result.response.status, 200);
        assert.equal(result.body.data.id, userId);
        assert.notEqual(cookie, oldCookie);
        assert.equal((await request("/me")).body.data.id, userId);
      },
    );
    await t.test(
      "session TTL expiry is rejected even before Mongo TTL cleanup runs",
      async () => {
        const mongoose = (await import("mongoose")).default;
        await mongoose.connection
          .collection("sessions")
          .updateMany({}, { $set: { expires: new Date(0) } });
        assert.equal((await request("/me")).response.status, 401);
      },
    );
    await t.test(
      "repeated authentication attempts are rate limited",
      async () => {
        let status = 0;
        for (let index = 0; index < 16; index++)
          status = (await request("/login", "POST", {}, await token())).response
            .status;
        assert.equal(status, 429);
      },
    );
  },
);
