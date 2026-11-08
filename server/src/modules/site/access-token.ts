import { createHash, createHmac } from "node:crypto";
import { env } from "../../config/env.js";

// Derivable links let organizers share them again without storing bearer tokens.
// Keep LINK_SECRET stable: rotating it deliberately invalidates existing links.
export function accessToken(
  kind: "guest" | "upload",
  id: string,
  nonce: string,
) {
  return createHmac("sha256", env.linkSecret)
    .update(kind + ":" + id + ":" + nonce)
    .digest("hex");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
