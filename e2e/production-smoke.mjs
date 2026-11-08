import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Exercise the actual compiled entry point, with no real database/cloud services.
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const server = spawn(process.execPath, ["server/dist/main.js"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: "4174",
    MONGODB_URI: mongo.getUri("production_smoke"),
    SESSION_SECRET:
      "isolated-production-smoke-session-secret-at-least-32-characters",
    LINK_SECRET:
      "isolated-production-smoke-links-secret-at-least-32-characters",
    APP_ORIGIN: "https://wedding.example",
    TRUST_PROXY_CIDRS: "127.0.0.1/32",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    AWS_REGION: "",
    AWS_DEFAULT_REGION: "",
    S3_BUCKET: "",
    AWS_PROFILE: "",
    GOOGLE_PLACES_API_KEY: "",
    GOOGLE_TRANSLATION_API_KEY: "",
    SUPPORT_EMAIL: "support@example.com",
    PRIVACY_POLICY_URL: "https://example.com/privacy",
    TERMS_URL: "https://example.com/terms",
  },
  stdio: ["ignore", "ignore", "pipe"],
});
let stderr = "";
server.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});
try {
  const base = "http://127.0.0.1:4174";
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Production startup failed: " + stderr);
    try {
      const response = await fetch(base + "/api/v1/health/ready", {
        signal: AbortSignal.timeout(1000),
      });
      ready = response.ok;
      await response.arrayBuffer();
      if (ready) break;
    } catch {
      /* Startup hasn't opened the listener yet. */
    }
    await delay(250);
  }
  assert.equal(ready, true, "Compiled production server did not become ready");
  const home = await fetch(base);
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(home.headers.get("strict-transport-security"), /max-age=/);
  const source = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  assert.ok(source, "Missing built frontend entry point");
  const asset = await fetch(base + source);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("cache-control"), /immutable/);
  await asset.arrayBuffer();
  const csrf = await fetch(base + "/api/v1/auth/csrf", {
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.equal(csrf.status, 200);
  const cookie = csrf.headers.get("set-cookie");
  assert.match(cookie, /__Host-mmm\.sid=/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; HttpOnly/);
  await csrf.arrayBuffer();
  const unknown = await fetch(base + "/api/v1/unknown", {
    headers: { Accept: "text/html" },
  });
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, "NOT_FOUND");
  console.info(
    "PASS compiled production startup, Mongo readiness, React assets, secure proxy cookies and API routing",
  );
} finally {
  if (server.exitCode === null) {
    const stopped = once(server, "exit");
    const timeout = setTimeout(() => server.kill("SIGKILL"), 11000);
    server.kill("SIGTERM");
    const [code] = await stopped;
    clearTimeout(timeout);
    if (code !== 0) process.exitCode = 1;
  }
  await mongo.stop();
}
