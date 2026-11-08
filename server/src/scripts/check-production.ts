import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

// Configuration/build checks only. No cloud changes, emails or database writes.
const checks = [
  { name: "Production environment", pass: env.isProduction },
  {
    name: "HTTPS application origin",
    pass: env.appOrigin.startsWith("https://"),
  },
  {
    name: "Independent stable link secret",
    pass: env.linkSecret !== env.sessionSecret,
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
    pass: Boolean(env.resendApiKey && env.resendFrom),
  },
  {
    name: "S3 region and private bucket name",
    pass: Boolean(env.awsRegion && env.s3Bucket),
  },
  { name: "Public support email", pass: Boolean(env.supportEmail) },
  { name: "Published privacy policy", pass: Boolean(env.privacyPolicyUrl) },
  { name: "Published terms", pass: Boolean(env.termsUrl) },
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
