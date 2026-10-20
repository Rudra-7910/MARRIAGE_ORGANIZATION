import path from "node:path";
import { isIP } from "node:net";
import dotenv from "dotenv";

// Resolve server/.env from this file, so commands also work from the repo root.
const envFile = path.resolve(import.meta.dirname, "../../.env");
dotenv.config({ path: envFile, quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
if (!["development", "test", "production"].includes(nodeEnv)) {
  throw new Error("NODE_ENV must be development, test, or production.");
}

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid number between 1 and 65535.");
}

const mongoUri = (process.env.MONGODB_URI || "").trim();
if (!mongoUri)
  throw new Error(
    "MONGODB_URI is required. Set it in server/.env before starting the server.",
  );
if (
  !mongoUri.startsWith("mongodb://") &&
  !mongoUri.startsWith("mongodb+srv://")
) {
  throw new Error("MONGODB_URI must be a MongoDB connection string.");
}

const sessionSecret = process.env.SESSION_SECRET || "";
if (sessionSecret.length < 32)
  throw new Error("SESSION_SECRET must have at least 32 characters.");
const appOrigin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const parsedOrigin = new URL(appOrigin);
if (
  parsedOrigin.origin !== appOrigin ||
  !["http:", "https:"].includes(parsedOrigin.protocol)
)
  throw new Error(
    "APP_ORIGIN must be an HTTP origin without a trailing slash.",
  );
if (nodeEnv === "production" && parsedOrigin.protocol !== "https:")
  throw new Error("Production APP_ORIGIN must use HTTPS.");

// In local development these two names reach the same Vite server.
// Production always accepts only the exact configured origin.
const allowedOrigins = [appOrigin];
if (
  nodeEnv !== "production" &&
  ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname)
) {
  const localAlias = new URL(appOrigin);
  localAlias.hostname =
    parsedOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
  allowedOrigins.push(localAlias.origin);
}

// Trust only explicitly configured proxy IPs/subnets; never trust arbitrary headers.
const trustedProxies = (process.env.TRUST_PROXY_CIDRS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
for (const proxy of trustedProxies) {
  const [address, prefix, extra] = proxy.split("/");
  const family = isIP(address || "");
  const maxPrefix = family === 4 ? 32 : 128;
  if (
    !family ||
    extra !== undefined ||
    (prefix !== undefined &&
      (!/^\d+$/.test(prefix) ||
        Number(prefix) < 1 ||
        Number(prefix) > maxPrefix))
  ) {
    throw new Error(
      "TRUST_PROXY_CIDRS must contain explicit IPs or CIDRs, not true, hop counts, or /0 networks.",
    );
  }
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  host: process.env.HOST || "127.0.0.1",
  mongoUri,
  sessionSecret,
  appOrigin,
  allowedOrigins,
  trustedProxies,
};
