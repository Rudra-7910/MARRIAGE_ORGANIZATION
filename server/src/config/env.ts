import dotenv from "dotenv";
import { z } from "zod";

// Load server/.env locally; Vercel provides its own environment variables.
if (process.env.VERCEL !== "1") {
  dotenv.config({ path: new URL("../../.env", import.meta.url), quiet: true });
}

const optionalHttpsUrl = z.url({ protocol: /^https$/ }).or(z.literal(""));
const settings = z
  .object({
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
  })
  .parse({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3001,
    LINK_SECRET: process.env.LINK_SECRET || undefined,
    APP_ORIGIN: process.env.APP_ORIGIN || "http://127.0.0.1:3000",
    SUPPORT_EMAIL: (process.env.SUPPORT_EMAIL || "").trim(),
    PRIVACY_POLICY_URL: (process.env.PRIVACY_POLICY_URL || "").trim(),
    TERMS_URL: (process.env.TERMS_URL || "").trim(),
  });

const isProduction = settings.NODE_ENV === "production";
const parsedOrigin = new URL(settings.APP_ORIGIN);
if (parsedOrigin.origin !== settings.APP_ORIGIN) {
  throw new Error(
    "APP_ORIGIN must be an HTTP origin without a trailing slash.",
  );
}
if (isProduction && parsedOrigin.protocol !== "https:") {
  throw new Error("Production APP_ORIGIN must use HTTPS.");
}
if (isProduction && !settings.LINK_SECRET) {
  throw new Error("Set a separate, stable LINK_SECRET before production.");
}

// Allow the localhost alias in development, keeping production origins exact.
const allowedOrigins = [settings.APP_ORIGIN];
if (
  !isProduction &&
  ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname)
) {
  const localAlias = new URL(settings.APP_ORIGIN);
  localAlias.hostname =
    parsedOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
  allowedOrigins.push(localAlias.origin);
}

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

export const env = {
  nodeEnv: settings.NODE_ENV,
  isProduction,
  port: settings.PORT,
  host: process.env.HOST || "127.0.0.1",
  mongoUri: settings.MONGODB_URI,
  sessionSecret: settings.SESSION_SECRET,
  linkSecret: settings.LINK_SECRET || settings.SESSION_SECRET,
  awsRegion: (
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    ""
  ).trim(),
  s3Bucket: (process.env.S3_BUCKET || "").trim(),
  awsRoleArn: (process.env.AWS_ROLE_ARN || "").trim(),
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",
  googleTranslationApiKey: process.env.GOOGLE_TRANSLATION_API_KEY || "",
  moderatorIds: (process.env.PLATFORM_MODERATOR_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  appOrigin: settings.APP_ORIGIN,
  supportEmail: settings.SUPPORT_EMAIL,
  privacyPolicyUrl: settings.PRIVACY_POLICY_URL,
  termsUrl: settings.TERMS_URL,
  allowedOrigins,
  trustedProxies,
  // Optional until invitations are enabled. These values never go to the browser.
  resendApiKey: (process.env.RESEND_API_KEY || "").trim(),
  resendFrom: (process.env.RESEND_FROM || "").trim(),
};
