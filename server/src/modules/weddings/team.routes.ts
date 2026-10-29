import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { httpError } from "../../middleware/error-handler.js";
import { checkCsrf, createSessionMiddleware } from "../auth/auth.session.js";
import { User } from "../auth/user.model.js";
import {
  Wedding,
  canOrganize,
  roleFor,
  weddingRoles,
} from "./wedding.models.js";

type WeddingDocument = InstanceType<typeof Wedding>;
const tokenInput = z.object({ token: z.hex().length(64).lowercase() }).strict();
const objectId = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Enter a valid ID.");

function allowedRoles(wedding: WeddingDocument, userId: string) {
  if (wedding.createdBy.toString() === userId) return [...weddingRoles];
  if (canOrganize(roleFor(wedding, userId))) return ["Manager", "Worker"];
  if (roleFor(wedding, userId) === "Manager") return ["Worker"];
  return [];
}
function canRemove(
  wedding: WeddingDocument,
  actorId: string,
  memberId: string,
) {
  if (memberId === actorId || memberId === wedding.createdBy.toString())
    return false;
  const member = wedding.members.find(
    (item) => item.userId.toString() === memberId,
  );
  if (!member) return false;
  if (canOrganize(member.role)) return wedding.createdBy.toString() === actorId;
  if (canOrganize(roleFor(wedding, actorId))) return true;
  return (
    roleFor(wedding, actorId) === "Manager" &&
    member.role === "Worker" &&
    member.invitedBy?.toString() === actorId
  );
}
function canRevoke(
  wedding: WeddingDocument,
  userId: string,
  role: string,
  inviter: string,
) {
  return (
    allowedRoles(wedding, userId).includes(role) &&
    (canOrganize(roleFor(wedding, userId)) || inviter === userId)
  );
}

export function createTeamRouter() {
  const router = Router();
  const previewLimit = rateLimit({
    windowMs: 60000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const createLimit = rateLimit({
    windowMs: 3600000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  // Read-only preview. The secret travels in the body, never in an API URL/log.
  router.post("/team-invites/preview", previewLimit, async (req, res) => {
    const { token } = tokenInput.parse(req.body);
    const hash = createHash("sha256").update(token).digest("hex");
    const wedding = await Wedding.findOne({ "teamInvites.tokenHash": hash });
    const invite = wedding?.teamInvites.find((item) => item.tokenHash === hash);
    if (!wedding || !invite)
      throw httpError(
        410,
        "INVITE_UNAVAILABLE",
        "This invitation is expired, revoked, or already used. Ask for a new link.",
      );
    const active =
      !invite.revokedAt &&
      !invite.acceptedBy &&
      invite.expiresAt > new Date() &&
      allowedRoles(wedding, invite.invitedBy.toString()).includes(invite.role);
    if (!active)
      throw httpError(
        410,
        "INVITE_UNAVAILABLE",
        "This invitation is expired, revoked, or already used. Ask for a new link.",
      );
    res.json({
      data: {
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        date: wedding.date,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  });

  const privatePaths = [
    "/team-invites/accept",
    "/weddings/current/team",
    "/weddings/current/team-invites",
    "/weddings/current/members",
    "/weddings/current/budget",
  ];
  router.use(privatePaths, createSessionMiddleware());
  router.use(privatePaths, async (req, _res, next) => {
    if (
      !req.session.userId ||
      !(await User.exists({ _id: req.session.userId }))
    )
      throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
    next();
  });

  router.get("/weddings/current/team", async (req, res) => {
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "members.userId": userId });
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "You do not belong to a wedding yet.",
      );
    const people = await User.find({
      _id: { $in: wedding.members.map((member) => member.userId) },
    })
      .select("name email")
      .lean();
    const peopleById = new Map(
      people.map((person) => [person._id.toString(), person]),
    );
    const privileged = canOrganize(roleFor(wedding, userId));
    res.json({
      data: {
        allowedRoles: allowedRoles(wedding, userId),
        members: wedding.members.map((member) => {
          const id = member.userId.toString();
          const person = peopleById.get(id);
          return {
            id,
            name: person?.name || "Wedding member",
            role: roleFor(wedding, id),
            ...(privileged || id === userId ? { email: person?.email } : {}),
            isCreator: id === wedding.createdBy.toString(),
            isYou: id === userId,
            canRemove: canRemove(wedding, userId, id),
          };
        }),
        invites: wedding.teamInvites
          .filter(
            (invite) =>
              !invite.acceptedBy &&
              (privileged || invite.invitedBy.toString() === userId),
          )
          .map((invite) => ({
            id: invite._id.toString(),
            role: invite.role,
            expiresAt: invite.expiresAt,
            status: invite.revokedAt
              ? "revoked"
              : invite.expiresAt <= new Date()
                ? "expired"
                : "pending",
            canRevoke:
              !invite.revokedAt &&
              invite.expiresAt > new Date() &&
              canRevoke(
                wedding,
                userId,
                invite.role,
                invite.invitedBy.toString(),
              ),
          })),
      },
    });
  });

  router.post(
    "/weddings/current/team-invites",
    checkCsrf,
    createLimit,
    async (req, res) => {
      const { role } = z
        .object({ role: z.enum(weddingRoles) })
        .strict()
        .parse(req.body);
      const userId = req.session.userId!;
      const wedding = await Wedding.findOne({ "members.userId": userId });
      if (!wedding)
        throw httpError(
          409,
          "WEDDING_REQUIRED",
          "You do not belong to a wedding yet.",
        );
      if (!allowedRoles(wedding, userId).includes(role))
        throw httpError(
          403,
          "FORBIDDEN",
          "You cannot invite someone with that role.",
        );
      if (wedding.teamInvites.length >= 500)
        throw httpError(
          409,
          "INVITE_LIMIT",
          "This wedding has reached its team invitation limit.",
        );
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const updated = await Wedding.findOneAndUpdate(
        { _id: wedding._id, __v: wedding.__v },
        {
          $push: {
            teamInvites: {
              tokenHash: createHash("sha256").update(token).digest("hex"),
              role,
              invitedBy: userId,
              expiresAt,
            },
          },
          $inc: { __v: 1 },
        },
        { returnDocument: "after", runValidators: true },
      );
      if (!updated)
        throw httpError(
          409,
          "TEAM_CONFLICT",
          "Team access changed. Refresh and try again.",
        );
      // Only returned at creation. The database keeps the hash, not a reusable link.
      res.status(201).json({
        data: {
          id: updated.teamInvites.at(-1)!._id.toString(),
          role,
          expiresAt,
          url: env.appOrigin + "/team-invites#" + token,
        },
      });
    },
  );

  router.post("/team-invites/accept", checkCsrf, async (req, res) => {
    const { token } = tokenInput.parse(req.body);
    const hash = createHash("sha256").update(token).digest("hex");
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "teamInvites.tokenHash": hash });
    const invite = wedding?.teamInvites.find((item) => item.tokenHash === hash);
    if (!wedding || !invite)
      throw httpError(
        410,
        "INVITE_UNAVAILABLE",
        "This invitation is expired, revoked, or already used. Ask for a new link.",
      );
    const existingRole = roleFor(wedding, userId);
    if (
      invite.acceptedBy?.toString() === userId &&
      existingRole === invite.role
    ) {
      res.json({ data: { role: existingRole } });
      return;
    }
    if (
      invite.acceptedBy ||
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      !allowedRoles(wedding, invite.invitedBy.toString()).includes(invite.role)
    )
      throw httpError(
        410,
        "INVITE_UNAVAILABLE",
        "This invitation is expired, revoked, or already used. Ask for a new link.",
      );
    if (await Wedding.exists({ "members.userId": userId }))
      throw httpError(
        409,
        "WEDDING_EXISTS",
        "You already belong to a wedding. This link cannot replace your current role.",
      );
    let updated;
    try {
      // Token consumption + membership grant happen in the SAME atomic write.
      // The unique members.userId index also prevents joining two weddings at once.
      updated = await Wedding.findOneAndUpdate(
        {
          _id: wedding._id,
          __v: wedding.__v,
          "members.userId": { $ne: userId },
          teamInvites: {
            $elemMatch: {
              _id: invite._id,
              tokenHash: hash,
              acceptedBy: null,
              revokedAt: null,
              expiresAt: { $gt: new Date() },
            },
          },
        },
        {
          $push: {
            members: { userId, role: invite.role, invitedBy: invite.invitedBy },
          },
          $set: {
            "teamInvites.$.acceptedBy": userId,
            "teamInvites.$.acceptedAt": new Date(),
          },
          $inc: { __v: 1 },
        },
        { returnDocument: "after", runValidators: true },
      );
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      )
        throw httpError(
          409,
          "WEDDING_EXISTS",
          "You already belong to a wedding.",
        );
      throw error;
    }
    if (!updated) {
      const latest = await Wedding.findById(wedding._id);
      const accepted = latest?.teamInvites.find(
        (item) => item.tokenHash === hash,
      );
      if (
        latest &&
        accepted?.acceptedBy?.toString() === userId &&
        roleFor(latest, userId) === invite.role
      ) {
        res.json({ data: { role: invite.role } });
        return;
      }
      throw httpError(
        409,
        "TEAM_CONFLICT",
        "Team access changed. Refresh and try again.",
      );
    }
    res.json({ data: { role: invite.role } });
  });

  router.delete(
    "/weddings/current/team-invites/:id",
    checkCsrf,
    async (req, res) => {
      const id = objectId.parse(req.params.id);
      const userId = req.session.userId!;
      const wedding = await Wedding.findOne({ "members.userId": userId });
      if (!wedding)
        throw httpError(
          409,
          "WEDDING_REQUIRED",
          "You do not belong to a wedding yet.",
        );
      const invite = wedding.teamInvites.id(id);
      if (!invite)
        throw httpError(
          404,
          "NOT_FOUND",
          "Invitation not found in your wedding.",
        );
      if (!canRevoke(wedding, userId, invite.role, invite.invitedBy.toString()))
        throw httpError(403, "FORBIDDEN", "You cannot revoke that invitation.");
      if (invite.acceptedBy)
        throw httpError(
          409,
          "INVITE_ACCEPTED",
          "This invitation was accepted. Remove the member to revoke their access.",
        );
      const updated = await Wedding.updateOne(
        { _id: wedding._id, __v: wedding.__v, "teamInvites._id": invite._id },
        { $set: { "teamInvites.$.revokedAt": new Date() }, $inc: { __v: 1 } },
      );
      if (!updated.matchedCount)
        throw httpError(
          409,
          "TEAM_CONFLICT",
          "Team access changed. Refresh and try again.",
        );
      res.json({ data: null });
    },
  );

  router.delete(
    "/weddings/current/members/:id",
    checkCsrf,
    async (req, res) => {
      const id = objectId.parse(req.params.id);
      const userId = req.session.userId!;
      const wedding = await Wedding.findOne({ "members.userId": userId });
      if (!wedding)
        throw httpError(
          409,
          "WEDDING_REQUIRED",
          "You do not belong to a wedding yet.",
        );
      if (!wedding.members.some((item) => item.userId.toString() === id))
        throw httpError(404, "NOT_FOUND", "Member not found in your wedding.");
      if (!canRemove(wedding, userId, id))
        throw httpError(
          403,
          "FORBIDDEN",
          "You cannot remove that member. The wedding creator’s access is protected.",
        );
      const updated = await Wedding.updateOne(
        { _id: wedding._id, __v: wedding.__v },
        {
          $pull: { members: { userId: id } },
          $set: { "teamInvites.$[invite].revokedAt": new Date() },
          $inc: { __v: 1 },
        },
        {
          arrayFilters: [
            {
              "invite.invitedBy": { $eq: id },
              "invite.acceptedBy": null,
              "invite.revokedAt": null,
            },
          ],
        },
      );
      if (!updated.matchedCount)
        throw httpError(
          409,
          "TEAM_CONFLICT",
          "Team access changed. Refresh and try again.",
        );
      res.json({ data: null });
    },
  );

  // Apply the finance guard before any budget response, including unknown subpaths.
  router.use("/weddings/current/budget", async (req, _res, next) => {
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "members.userId": userId });
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "You do not belong to a wedding yet.",
      );
    if (!canOrganize(roleFor(wedding, req.session.userId!)))
      throw httpError(
        403,
        "FORBIDDEN",
        "Only this wedding’s admins and organizers can access the budget.",
      );
    next();
  });
  router.get("/weddings/current/budget", (_req, res) => {
    res.json({
      data: { available: false, message: "Budget tracking is coming soon." },
    });
  });
  return router;
}
