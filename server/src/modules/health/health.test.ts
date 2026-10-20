import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

test("HTTP foundation handles health, unknown routes, and invalid bodies", async (t) => {
  // Test liveness during an outage without loading or connecting to the real Atlas config.
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI =
    "mongodb://127.0.0.1:27017/health_test_no_connection";
  process.env.SESSION_SECRET =
    "isolated-health-test-session-secret-at-least-32-characters";
  process.env.APP_ORIGIN = "http://127.0.0.1:3000";
  process.env.TRUST_PROXY_CIDRS = "";
  const { createApp } = await import("../../app.js");
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port.");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await t.test(
    "server configuration requires MongoDB and a session secret",
    () => {
      for (const missing of ["MONGODB_URI", "SESSION_SECRET"]) {
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
            env: { ...process.env, [missing]: "" },
            encoding: "utf8",
          },
        );
        assert.notEqual(child.status, 0);
        assert.ok(child.stderr.includes(missing));
      }
    },
  );

  await t.test("root identifies the API", async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.apiVersion, "v1");
    assert.equal(response.headers.get("x-powered-by"), null);
  });

  await t.test("liveness works without a database connection", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "live");
  });

  await t.test(
    "readiness does not claim a disconnected database is ready",
    async () => {
      const response = await fetch(`${baseUrl}/api/v1/health/ready`);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).data.status, "not_ready");
    },
  );

  await t.test("unknown endpoints have a traceable JSON error", async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
    assert.ok(body.requestId);
    assert.equal(body.requestId, response.headers.get("x-request-id"));
  });

  await t.test("malformed JSON returns 400", async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_JSON");
  });

  await t.test("oversized JSON returns 413", async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "a".repeat(110000) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
  });
});
