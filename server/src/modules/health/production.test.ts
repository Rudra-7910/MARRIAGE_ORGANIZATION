import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("one Express origin serves SPA routes, safe assets and JSON-only API errors", async (t) => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://127.0.0.1:27017/no_connection_for_static_test",
    SESSION_SECRET:
      "isolated-static-production-tests-secret-at-least-32-characters",
    APP_ORIGIN: "http://127.0.0.1:3000",
    AWS_REGION: "ap-south-1",
    S3_BUCKET: "test-private-photos",
    SUPPORT_EMAIL: "support@example.com",
    PRIVACY_POLICY_URL: "https://example.com/privacy",
    TERMS_URL: "https://example.com/terms",
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), "mmm-static-test-"));
  await mkdir(path.join(directory, "assets"));
  await writeFile(
    path.join(directory, "index.html"),
    "<!doctype html><html><body><div id='root'>Test frontend</div></body></html>",
  );
  await writeFile(
    path.join(directory, "assets", "app-123.js"),
    "console.log('bundled')",
  );
  const { createApp } = await import("../../app.js");
  const server = createServer(createApp({ webRoot: directory }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  const base = "http://127.0.0.1:" + address.port;
  await t.test(
    "home and browser refreshes on nested application/guest routes receive the build",
    async () => {
      for (const route of [
        "/",
        "/login",
        "/app/budget",
        "/w/example",
        "/reset-password",
        "/upload/example",
      ]) {
        const response = await fetch(base + route, {
          headers: { Accept: "text/html" },
        });
        assert.equal(response.status, 200, route);
        assert.match(response.headers.get("content-type")!, /text\/html/);
        assert.equal(response.headers.get("cache-control"), "no-cache");
        assert.match(await response.text(), /Test frontend/);
      }
    },
  );
  await t.test(
    "hashed assets have immutable caching, while missing assets/APIs never return HTML",
    async () => {
      const asset = await fetch(base + "/assets/app-123.js");
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("cache-control")!, /immutable/);
      assert.equal(asset.headers.get("set-cookie"), null);
      for (const route of [
        "/api/not-real",
        "/api/v1/not-real",
        "/assets/missing.js",
        "/missing.png",
        "/.env",
      ]) {
        const response = await fetch(base + route, {
          headers: { Accept: "text/html" },
        });
        assert.equal(response.status, 404, route);
        assert.equal((await response.json()).error.code, "NOT_FOUND");
      }
    },
  );
  await t.test(
    "the CSP allows exactly our configured integrations and blocks embedding",
    async () => {
      const response = await fetch(base);
      const csp = response.headers.get("content-security-policy")!;
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.match(csp, /https:\/\/www.youtube-nocookie.com/);
      assert.match(
        csp,
        /https:\/\/test-private-photos.s3.ap-south-1.amazonaws.com/,
      );
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    },
  );
  await t.test(
    "only public support metadata is returned; health root and readiness report database outages",
    async () => {
      const response = await fetch(base + "/api/v1/site-info");
      assert.deepEqual((await response.json()).data, {
        supportEmail: "support@example.com",
        privacyPolicyUrl: "https://example.com/privacy",
        termsUrl: "https://example.com/terms",
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      for (const route of ["/api/v1/health", "/api/v1/health/ready"]) {
        assert.equal((await fetch(base + route)).status, 503);
      }
      assert.equal((await fetch(base + "/api/v1/health/live")).status, 200);
    },
  );
});
