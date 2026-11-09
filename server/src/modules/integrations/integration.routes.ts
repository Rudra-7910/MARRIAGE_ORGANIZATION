import { Router } from "express";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { z } from "zod";
import { PlacesClient } from "@googlemaps/places";
import { v2 } from "@google-cloud/translate";
import { rateLimit } from "express-rate-limit";
import { httpError } from "../../middleware/error-handler.js";
import { createSessionMiddleware } from "../auth/auth.session.js";
import { requireUser } from "../../middleware/wedding-access.js";

export const interfaceLabels = [
  "Guests & Invites",
  "Your service profile",
  "The workspace",
  "How it works",
  "For your guests",
  "Log in",
  "Plan your wedding",
  "Overview",
  "Functions",
  "Teams & Services",
  "Need Your Attention",
  "Budget & Expenses",
  "Guests & Invitations",
  "Photos",
  "Find Services",
  "People & Access",
  "Guest Website",
  "Wedding Settings",
  "Log out",
  "Open menu",
  "Close menu",
  "View guest website",
  "Create your wedding",
  "Guest updates",
  "Service profile",
  "Save changes",
  "Cancel",
  "Try again",
  "Directions",
  "Contact organizer",
  "Wedding day",
  "Days",
  "Hours",
  "Minutes",
  "Seconds",
  "Our wedding",
  "The celebrations",
  "Getting there",
  "Watch live",
  "Gallery",
  "Share your photos",
  "English",
  "Hindi",
] as const;
export const TranslationCache = mongoose.model(
  "TranslationCache",
  new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    labels: { type: Map, of: String, required: true },
    expiresAt: { type: Date, required: true },
    leaseUntil: { type: Date, default: null },
  }),
);
const translationKey =
  "hi-" +
  createHash("sha256").update(JSON.stringify(interfaceLabels)).digest("hex");
let places: PlacesClient | undefined;
let translator: InstanceType<typeof v2.Translate> | undefined;

export function createIntegrationRouter() {
  const router = Router();
  const limit = rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.get("/interface-labels/hi", limit, async (_req, res) => {
    // Clients can request only this catalog, never arbitrary names or private wedding content.
    const saved = await TranslationCache.findOne({
      key: translationKey,
      expiresAt: { $gt: new Date() },
    });
    if (saved) {
      res.json({ data: Object.fromEntries(saved.labels) });
      return;
    }
    if (!process.env.GOOGLE_TRANSLATION_API_KEY)
      throw httpError(
        503,
        "TRANSLATION_UNAVAILABLE",
        "Hindi translation is not configured yet. English remains available.",
      );
    await TranslationCache.updateOne(
      { key: translationKey },
      { $setOnInsert: { labels: {}, expiresAt: new Date(0) } },
      { upsert: true },
    );
    const lease = await TranslationCache.updateOne(
      {
        key: translationKey,
        $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }],
      },
      { $set: { leaseUntil: new Date(Date.now() + 30000) } },
    );
    if (!lease.modifiedCount)
      throw httpError(
        503,
        "TRANSLATION_BUSY",
        "Translation is loading. Please try again shortly.",
      );
    try {
      if (!translator) {
        translator = new v2.Translate({
          key: process.env.GOOGLE_TRANSLATION_API_KEY,
        });
      }
      const [translations] = await translator.translate([...interfaceLabels], {
        from: "en",
        to: "hi",
        format: "text",
      });
      const labels: Record<string, string> = {};
      for (let index = 0; index < interfaceLabels.length; index++) {
        const label = interfaceLabels[index]!;
        labels[label] = translations[index] || label;
      }
      await TranslationCache.updateOne(
        { key: translationKey },
        {
          $set: {
            labels,
            expiresAt: new Date(Date.now() + 86400000),
            leaseUntil: null,
          },
        },
      );
      res.json({ data: labels });
    } catch {
      await TranslationCache.updateOne(
        { key: translationKey },
        { $set: { leaseUntil: null } },
      );
      throw httpError(
        502,
        "TRANSLATION_FAILED",
        "Hindi translation is temporarily unavailable. Please use English for now.",
      );
    }
  });
  router.get(
    "/integrations/places",
    createSessionMiddleware(),
    requireUser,
    limit,
    async (req, res) => {
      const { search } = z
        .object({ search: z.string().trim().min(3).max(100) })
        .strict()
        .parse(req.query);
      if (!process.env.GOOGLE_PLACES_API_KEY)
        throw httpError(
          503,
          "PLACES_UNAVAILABLE",
          "Place search is not configured yet. You can enter the address and coordinates manually.",
        );
      try {
        if (!places) {
          places = new PlacesClient({ apiKey: process.env.GOOGLE_PLACES_API_KEY });
        }
        const [response] = await places.searchText(
          {
            textQuery: search,
            regionCode: "IN",
            languageCode: "en",
            maxResultCount: 5,
          },
          {
            timeout: 10000,
            otherArgs: {
              headers: {
                "X-Goog-FieldMask":
                  "places.id,places.displayName,places.formattedAddress,places.location",
              },
            },
          },
        );
        const results = (response.places || [])
          .filter(
            (place) =>
              place.location?.latitude != null &&
              place.location?.longitude != null,
          )
          .map((place) => ({
            id: place.id,
            name: place.displayName?.text || "",
            address: place.formattedAddress || "",
            latitude: place.location!.latitude,
            longitude: place.location!.longitude,
          }));
        res.json({ data: results });
      } catch {
        throw httpError(
          502,
          "PLACES_FAILED",
          "Place search is temporarily unavailable. Enter the address manually or try again.",
        );
      }
    },
  );
  return router;
}
