import dotenv from "dotenv";
import { z } from "zod";

// Load server/.env locally; Vercel provides its own environment variables.
if (process.env.VERCEL !== "1") {
  dotenv.config({ path: new URL("../../.env", import.meta.url), quiet: true });
}

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.PORT = process.env.PORT || "3001";
process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.APP_ORIGIN = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
process.env.AWS_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "";

for (const name of [
  "MONGODB_URI",
  "AWS_REGION",
  "AWS_ROLE_ARN",
  "S3_BUCKET",
  "SUPPORT_EMAIL",
  "PRIVACY_POLICY_URL",
  "TERMS_URL",
  "RESEND_API_KEY",
  "RESEND_FROM",
]) {
  process.env[name] = (process.env[name] || "").trim();
}
process.env.PLATFORM_MODERATOR_USER_IDS = (
  process.env.PLATFORM_MODERATOR_USER_IDS || ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .join(",");

// Validate once at startup. Other files read process.env directly.
const optionalHttpsUrl = z.url({ protocol: /^https$/ }).or(z.literal(""));
z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGODB_URI: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
      "MONGODB_URI must be a MongoDB connection string.",
    ),
  SESSION_SECRET: z.string().min(32),
  LINK_SECRET: z.string().min(32).optional(),
  APP_ORIGIN: z.url({ protocol: /^https?$/ }),
  SUPPORT_EMAIL: z.email().or(z.literal("")),
  PRIVACY_POLICY_URL: optionalHttpsUrl,
  TERMS_URL: optionalHttpsUrl,
}).parse({
  ...process.env,
  LINK_SECRET: process.env.LINK_SECRET || undefined,
});

const parsedOrigin = new URL(process.env.APP_ORIGIN);
if (parsedOrigin.origin !== process.env.APP_ORIGIN) {
  throw new Error(
    "APP_ORIGIN must be an HTTP origin without a trailing slash.",
  );
}
if (
  process.env.NODE_ENV === "production" &&
  parsedOrigin.protocol !== "https:"
) {
  throw new Error("Production APP_ORIGIN must use HTTPS.");
}
if (process.env.NODE_ENV === "production" && !process.env.LINK_SECRET) {
  throw new Error("Set a separate, stable LINK_SECRET before production.");
}

process.env.LINK_SECRET = process.env.LINK_SECRET || process.env.SESSION_SECRET;

const trustedProxies = (process.env.TRUST_PROXY_CIDRS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const proxyAddress = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);
if (
  trustedProxies.some(
    (proxy) => proxy.endsWith("/0") || !proxyAddress.safeParse(proxy).success,
  )
) {
  throw new Error(
    "TRUST_PROXY_CIDRS must contain specific proxy IPs or CIDRs, never /0 networks.",
  );
}
