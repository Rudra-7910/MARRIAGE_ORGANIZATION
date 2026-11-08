import type { ClientSession } from "mongoose";
import type { RequestHandler } from "express";
import { User } from "../modules/auth/user.model.js";
import {
  Wedding,
  canOrganize,
  roleFor,
} from "../modules/weddings/wedding.models.js";
import { httpError } from "./error-handler.js";

export const requireUser: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as InstanceType<typeof User> | undefined;
  if (!user)
    throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
  res.locals.user = user;
  next();
};

export const requireWedding: RequestHandler = async (req, res, next) => {
  const wedding = await Wedding.findOne({
    "members.userId": req.session.userId,
  });
  if (!wedding)
    throw httpError(409, "WEDDING_REQUIRED", "Create or join a wedding first.");
  res.locals.wedding = wedding;
  res.locals.role = roleFor(wedding, req.session.userId!);
  next();
};

export const requireOrganizer: RequestHandler = (_req, res, next) => {
  if (!canOrganize(res.locals.role)) {
    throw httpError(
      403,
      "FORBIDDEN",
      "Only this wedding’s organizers can make this change.",
    );
  }
  next();
};

// Cross-collection writes must conflict with membership removal in the same transaction.
// This counter serializes access without changing the public wedding-detail version.
export async function lockOrganizerAccess(
  wedding: InstanceType<typeof Wedding>,
  userId: string,
  session: ClientSession,
) {
  const allowed = await Wedding.updateOne(
    {
      _id: wedding._id,
      __v: wedding.__v,
      members: {
        $elemMatch: { userId, role: { $in: ["Admin", "Organizer"] } },
      },
    },
    { $inc: { permissionRevision: 1 } },
    { session },
  );
  if (!allowed.matchedCount)
    throw httpError(
      409,
      "ACCESS_CONFLICT",
      "Wedding details or access changed. Reload before continuing.",
    );
}
