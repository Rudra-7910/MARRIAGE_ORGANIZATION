import "../config/env.js";
import { existsSync } from "node:fs";
import path from "node:path";

// Configuration/build checks only. No cloud changes, emails or database writes.
const checks = [
  {
    name: "Production environment",
    pass: process.env.NODE_ENV === "production",
  },
  {
    name: "HTTPS application origin",
    pass: process.env.APP_ORIGIN!.startsWith("https://"),
  },
  {
    name: "Independent stable link secret",
    pass: process.env.LINK_SECRET! !== process.env.SESSION_SECRET!,
  },
  {
    name: "React production build",
    pass: existsSync(
      path.resolve(import.meta.dirname, "../../../web/dist/index.html"),
    ),
  },
  {
    name: "Compiled Express entry point",
    pass: existsSync(path.resolve(import.meta.dirname, "../main.js")),
  },
  {
    name: "Resend key and verified sender address",
    pass: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
  },
  {
    name: "S3 region and private bucket name",
    pass: Boolean(process.env.AWS_REGION && process.env.S3_BUCKET),
  },
  {
    name: "Public support email",
    pass: Boolean(process.env.SUPPORT_EMAIL || ""),
  },
  {
    name: "Published privacy policy",
    pass: Boolean(process.env.PRIVACY_POLICY_URL || ""),
  },
  { name: "Published terms", pass: Boolean(process.env.TERMS_URL || "") },
];
for (const check of checks)
  console.info(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
console.info(
  "CHECK AWS role permissions, S3 CORS, Atlas network/replica set, HTTPS proxy trust, verified sender and backups separately.",
);
console.info(
  "Google Places / Hindi labels are optional; missing keys keep those integrations unavailable.",
);
if (checks.some((check) => !check.pass)) process.exitCode = 1;
