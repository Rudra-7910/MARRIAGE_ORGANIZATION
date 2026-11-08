import { createServer } from "node:http";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Disposable Mongo replica set and injected email sender: never Atlas or real mail.
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: mongo.getUri("browser_smoke"),
  SESSION_SECRET: "isolated-browser-test-session-secret-at-least-32-characters",
  LINK_SECRET: "isolated-browser-test-links-secret-at-least-32-characters",
  APP_ORIGIN: "http://127.0.0.1:4173",
  TRUST_PROXY_CIDRS: "",
  RESEND_API_KEY: "test-injected-sender-no-real-mail",
  RESEND_FROM: "QA <test@example.com>",
  AWS_REGION: "",
  AWS_DEFAULT_REGION: "",
  S3_BUCKET: "",
  AWS_PROFILE: "",
  GOOGLE_PLACES_API_KEY: "",
  GOOGLE_TRANSLATION_API_KEY: "",
  PLATFORM_MODERATOR_USER_IDS: "",
  SUPPORT_EMAIL: "support@example.com",
  PRIVACY_POLICY_URL: "https://example.com/privacy",
  TERMS_URL: "https://example.com/terms",
});
const { connectDatabase, disconnectDatabase } =
  await import("../server/dist/config/database.js");
const { createApp } = await import("../server/dist/app.js");
const { attachRealtime } = await import("../server/dist/config/realtime.js");
await connectDatabase();
const app = createApp({
  webRoot: path.resolve("web/dist"),
  sendEmail: async () => ({
    status: "submitted",
    providerId: "browser-test-email",
  }),
});
const server = createServer(app);
const io = attachRealtime(server, app);
server.listen(4173, "127.0.0.1");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => io.close(resolve));
  await disconnectDatabase();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
