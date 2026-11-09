import type { WeddingDocument } from "../weddings/wedding.models.js";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { Wedding } from "../weddings/wedding.models.js";
import { Guest } from "../invitations/invitation.model.js";
import { checkCsrf, createSessionMiddleware } from "../auth/auth.session.js";
import {
  requireUser,
  requireWedding,
  requireOrganizer,
} from "../../middleware/wedding-access.js";
import { httpError } from "../../middleware/error-handler.js";
import { accessToken, tokenHash } from "./access-token.js";
import { env } from "../../config/env.js";

const id = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid record ID.");
const announcementInput = z
  .object({
    title: z.string().trim().min(2).max(120),
    text: z.string().trim().min(3).max(1000),
    scope: z.enum(["public", "functions"]),
    functionIds: z.array(id).max(50),
    published: z.boolean(),
  })
  .strict()
  .refine(
    (value) => value.scope !== "functions" || value.functionIds.length > 0,
    "Choose at least one invited function.",
  );
const commandInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("add"),
      version: z.number().int().min(0),
      values: announcementInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("edit"),
      version: z.number().int().min(0),
      id,
      values: announcementInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      version: z.number().int().min(0),
      id,
    })
    .strict(),
]);


function announcements(wedding: WeddingDocument, functionIds: string[] | null) {
  return (wedding.site?.announcements || [])
    .filter(
      (item) =>
        functionIds === null ||
        (item.published &&
          (item.scope === "public" ||
            item.functionIds.some((id) =>
              functionIds.includes(id.toString()),
            ))),
    )
    .map((item) => ({
      id: item._id.toString(),
      title: item.title,
      text: item.text,
      scope: item.scope,
      functionIds: item.functionIds.map(String),
      published: item.published,
      updatedAt: item.updatedAt.toISOString(),
    }));
}
function invitedFunctions(wedding: WeddingDocument, ids: string[]) {
  return (wedding.planning?.functions || [])
    .filter((item) => ids.includes(item._id.toString()))
    .map((item) => ({
      id: item._id.toString(),
      name: item.name,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      venue: item.venue,
      address: item.address,
      city: item.city,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export function createSiteRouter() {
  const router = Router();
  const publicLimit = rateLimit({
    windowMs: 60000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.get(
    "/public/weddings/:publicId/announcements",
    publicLimit,
    async (req, res) => {
      const wedding = await Wedding.findOne({
        publicId: req.params.publicId,
      }).select("+site");
      if (!wedding)
        throw httpError(404, "NOT_FOUND", "Wedding website not found.");
      res.json({ data: announcements(wedding, []) });
    },
  );
  router.post(
    "/public/weddings/:publicId/invitation",
    publicLimit,
    async (req, res) => {
      const { token } = z
        .object({ token: z.hex().length(64) })
        .strict()
        .parse(req.body);
      const wedding = await Wedding.findOne({
        publicId: req.params.publicId,
      }).select("+site");
      const guest =
        wedding &&
        (await Guest.findOne({
          wedding: wedding._id,
          accessHash: tokenHash(token),
          accessRevoked: false,
        }).select("+accessNonce"));
      if (
        !wedding ||
        !guest ||
        !guest.accessNonce ||
        accessToken("guest", guest.id, guest.accessNonce) !== token
      )
        throw httpError(
          404,
          "INVITATION_UNAVAILABLE",
          "This invitation link is invalid or has been withdrawn. Contact an organizer.",
        );
      const ids = guest.invitedFunctionIds.map(String);
      res.json({
        data: {
          name: guest.name,
          side: guest.side,
          functions: invitedFunctions(wedding, ids),
          announcements: announcements(wedding, ids),
        },
      });
    },
  );
  router.use(
    "/weddings/current/announcements",
    createSessionMiddleware(),
    requireUser,
    requireWedding,
    requireOrganizer,
  );
  router.get("/weddings/current/announcements", async (_req, res) => {
    const wedding = await Wedding.findById(res.locals.wedding._id).select(
      "+site",
    );
    if (!wedding) throw httpError(404, "NOT_FOUND", "Wedding not found.");
    res.json({
      data: {
        version: wedding.site?.version || 0,
        announcements: announcements(wedding, null),
      },
    });
  });
  router.patch(
    "/weddings/current/announcements",
    checkCsrf,
    async (req, res) => {
      const command = commandInput.parse(req.body);
      const wedding = await Wedding.findById(res.locals.wedding._id).select(
        "+site",
      );
      if (!wedding) throw httpError(404, "NOT_FOUND", "Wedding not found.");
      const site = wedding.site!;
      if (command.version !== site.version)
        throw httpError(
          409,
          "SITE_CONFLICT",
          "Updates changed. Reload before saving.",
        );
      if (
        "values" in command &&
        command.values.functionIds.some(
          (id) => !wedding.planning?.functions.id(id),
        )
      )
        throw httpError(
          422,
          "INVALID_INPUT",
          "Choose functions from this wedding.",
        );
      if (command.action === "add") {
        if (site.announcements.length >= 100)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "Remove an old update before adding another.",
          );
        site.announcements.push(command.values);
      } else {
        const item = site.announcements.id(command.id);
        if (!item) throw httpError(404, "NOT_FOUND", "Update not found.");
        if (command.action === "remove") item.deleteOne();
        else item.set({ ...command.values, updatedAt: new Date() });
      }
      site.version++;
      const updated = await Wedding.findOneAndUpdate(
        {
          _id: wedding._id,
          __v: wedding.__v,
          members: {
            $elemMatch: {
              userId: req.session.userId,
              role: { $in: ["Admin", "Organizer"] },
            },
          },
        },
        { $set: { site: wedding.toObject().site }, $inc: { __v: 1 } },
        { returnDocument: "after", runValidators: true },
      ).select("+site");
      if (!updated)
        throw httpError(
          409,
          "SITE_CONFLICT",
          "Updates or permissions changed. Reload before saving.",
        );
      res.json({
        data: {
          version: updated.site!.version,
          announcements: announcements(updated, null),
        },
      });
    },
  );
  // The guest grant is independent of the frozen email: previously sent messages stay immutable.
  router.use(
    "/weddings/current/guests/:id/access",
    createSessionMiddleware(),
    requireUser,
    requireWedding,
    requireOrganizer,
  );
  router.patch(
    "/weddings/current/guests/:id/access",
    checkCsrf,
    async (req, res) => {
      const guestId = id.parse(req.params.id);
      const values = z
        .object({
          version: z.number().int().min(0),
          functionIds: z.array(id).max(50),
          revoked: z.boolean(),
        })
        .strict()
        .parse(req.body);
      const wedding = res.locals.wedding as WeddingDocument;
      if (
        new Set(values.functionIds).size !== values.functionIds.length ||
        values.functionIds.some((id) => !wedding.planning?.functions.id(id))
      )
        throw httpError(
          422,
          "INVALID_INPUT",
          "Choose unique functions from this wedding.",
        );
      const nonce = randomBytes(16).toString("hex");
      const updated = await mongoose.connection.transaction(async (session) => {
        const authorized = await Wedding.updateOne(
          {
            _id: wedding._id,
            __v: wedding.__v,
            members: {
              $elemMatch: {
                userId: req.session.userId,
                role: { $in: ["Admin", "Organizer"] },
              },
            },
          },
          { $inc: { __v: 1 } },
          { session },
        );
        if (!authorized.matchedCount)
          throw httpError(
            409,
            "ACCESS_CONFLICT",
            "Wedding access changed. Reload before saving.",
          );
        const guest = await Guest.findOne({
          _id: guestId,
          wedding: wedding._id,
          __v: values.version,
        })
          .select("+accessNonce")
          .session(session);
        if (!guest)
          throw httpError(
            409,
            "ACCESS_CONFLICT",
            "Guest access changed. Reload before saving.",
          );
        const activeNonce = guest.accessNonce || nonce;
        return Guest.findOneAndUpdate(
          { _id: guestId, wedding: wedding._id, __v: values.version },
          {
            $set: {
              invitedFunctionIds: values.functionIds,
              accessRevoked: values.revoked,
              accessNonce: activeNonce,
              accessHash: tokenHash(accessToken("guest", guestId, activeNonce)),
            },
            $inc: { __v: 1 },
          },
          { session, returnDocument: "after", runValidators: true },
        ).select("+accessNonce");
      });
      if (!updated)
        throw httpError(
          409,
          "ACCESS_CONFLICT",
          "Guest access changed. Reload before saving.",
        );
      res.json({
        data: {
          version: updated.__v,
          functionIds: updated.invitedFunctionIds.map(String),
          revoked: updated.accessRevoked,
          url: updated.accessRevoked
            ? null
            : env.appOrigin +
              "/w/" +
              wedding.publicId +
              "#invite=" +
              accessToken("guest", guestId, updated.accessNonce!),
        },
      });
    },
  );
  return router;
}
