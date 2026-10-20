import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "production sessions honor only configured reverse proxies",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "production";
    process.env.MONGODB_URI = mongo.getUri("auth_proxy_test");
    process.env.SESSION_SECRET =
      "isolated-production-proxy-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "https://wedding.example";
    process.env.TRUST_PROXY_CIDRS = "127.0.0.1/32";
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    let server: ReturnType<typeof createServer> | undefined;
    t.after(async () => {
      const running = server;
      if (running) {
        running.closeAllConnections();
        await new Promise<void>((resolve) => running.close(() => resolve()));
      }
      await disconnectDatabase();
      await mongo.stop();
    });
    await connectDatabase();
    const app = createApp();
    assert.deepEqual(app.get("trust proxy"), ["127.0.0.1/32"]);
    server = createServer(app);
    const running = server;
    await new Promise<void>((resolve) =>
      running.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}/api/v1/auth`;

    await t.test(
      "trusted HTTPS proxy sets secure cookie and supports signup/current user/logout",
      async () => {
        const forwarded = {
          "X-Forwarded-Proto": "https",
          "X-Forwarded-For": "192.0.2.25",
        };
        const csrf = await fetch(base + "/csrf", { headers: forwarded });
        assert.equal(csrf.status, 200);
        const header = csrf.headers.get("set-cookie") || "";
        assert.match(header, /__Host-mmm\.sid=/);
        assert.match(header, /; Secure/);
        assert.match(header, /; HttpOnly/);
        const token = (await csrf.json()).data.token;
        const signup = await fetch(base + "/signup", {
          method: "POST",
          headers: {
            ...forwarded,
            Cookie: header.split(";")[0],
            Origin: process.env.APP_ORIGIN!,
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
          },
          body: JSON.stringify({
            name: "Proxy QA",
            email: "proxy@example.com",
            password: "Disposable-Proxy-2027",
          }),
        });
        assert.equal(signup.status, 201);
        const cookie = signup.headers.get("set-cookie")!.split(";")[0];
        assert.equal(
          (
            await fetch(base + "/me", {
              headers: { ...forwarded, Cookie: cookie },
            })
          ).status,
          200,
        );
        const logoutCsrf = await fetch(base + "/csrf", {
          headers: { ...forwarded, Cookie: cookie },
        });
        const logoutToken = (await logoutCsrf.json()).data.token;
        const logout = await fetch(base + "/logout", {
          method: "POST",
          headers: {
            ...forwarded,
            Cookie: cookie,
            Origin: process.env.APP_ORIGIN!,
            "X-CSRF-Token": logoutToken,
          },
        });
        assert.equal(logout.status, 200);
        assert.equal(
          (
            await fetch(base + "/me", {
              headers: { ...forwarded, Cookie: cookie },
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "production rejects local origins even with a valid CSRF token",
      async () => {
        const headers = { "X-Forwarded-Proto": "https" };
        const csrf = await fetch(base + "/csrf", { headers });
        const cookie = csrf.headers.get("set-cookie")!.split(";")[0];
        const token = (await csrf.json()).data.token;
        const logout = await fetch(base + "/logout", {
          method: "POST",
          headers: {
            ...headers,
            Cookie: cookie,
            Origin: "http://localhost:3000",
            "X-CSRF-Token": token,
          },
        });
        assert.equal(logout.status, 403);
        await logout.arrayBuffer();
      },
    );
    await t.test("plain HTTP never receives a production cookie", async () => {
      const response = await fetch(base + "/csrf");
      assert.equal(response.headers.get("set-cookie"), null);
      await response.arrayBuffer();
    });
    await t.test(
      "untrusted source cannot turn forwarded HTTPS into a secure connection",
      async () => {
        app.set("trust proxy", ["192.0.2.0/24"]);
        const response = await fetch(base + "/csrf", {
          headers: { "X-Forwarded-Proto": "https" },
        });
        assert.equal(response.headers.get("set-cookie"), null);
        await response.arrayBuffer();
      },
    );
    await t.test("unsafe blanket proxy trust values are rejected", () => {
      for (const value of ["true", "1", "0.0.0.0/0", "::/0", "127.0.0.1/33"]) {
        const child = spawnSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            "await import('./src/config/env.ts')",
          ],
          {
            cwd: new URL("../../../", import.meta.url),
            env: { ...process.env, TRUST_PROXY_CIDRS: value },
            encoding: "utf8",
          },
        );
        assert.notEqual(child.status, 0, value);
        assert.match(child.stderr, /TRUST_PROXY_CIDRS/, value);
      }
    });
  },
);
