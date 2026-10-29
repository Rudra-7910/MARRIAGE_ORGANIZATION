import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Family, Wedding, canOrganize, roleFor } from "./wedding.models.js";
import { User } from "../auth/user.model.js";
import { createSessionMiddleware, checkCsrf } from "../auth/auth.session.js";
import { httpError } from "../../middleware/error-handler.js";

const familyInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    side: z.enum(["Bride", "Groom", "Both"]),
  })
  .strict();

const weddingInput = z
  .object({
    brideName: z.string().trim().min(1).max(80),
    groomName: z.string().trim().min(1).max(80),
    date: z.iso.date(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid ceremony time."),
    endTime: z.union([
      z.literal(""),
      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    ]),
    venue: z.string().trim().min(2).max(160),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(100),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    contactRole: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid contact phone number."),
    welcome: z.string().trim().max(1000),
    youtube: z
      .string()
      .trim()
      .max(300)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            [
              "youtube.com",
              "www.youtube.com",
              "youtu.be",
              "m.youtube.com",
            ].includes(url.hostname)
          );
        } catch {
          return false;
        }
      }, "Use an HTTPS YouTube link."),
  })
  .strict();

function checkCoordinates(value: {
  latitude: number | null;
  longitude: number | null;
}) {
  if ((value.latitude === null) !== (value.longitude === null))
    throw httpError(
      422,
      "INVALID_INPUT",
      "Add both latitude and longitude, or leave both empty.",
    );
}
// This is the deliberate guest-safe projection, also used by the organizer UI.
// No membership IDs, account email, family ownership or financial data is public.
function details(wedding: InstanceType<typeof Wedding>) {
  return {
    publicId: wedding.publicId,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    date: wedding.date,
    startTime: wedding.startTime,
    endTime: wedding.endTime,
    venue: wedding.venue,
    address: wedding.address,
    city: wedding.city,
    latitude: wedding.latitude,
    longitude: wedding.longitude,
    contactRole: wedding.contactRole,
    phone: wedding.phone,
    welcome: wedding.welcome,
    youtube: wedding.youtube,
  };
}
// Format a consistent response without making hidden database calls.
function workspaceData(
  wedding: InstanceType<typeof Wedding> | null,
  family: InstanceType<typeof Family> | null,
  userId: string,
) {
  return {
    family: family
      ? { id: family.id, name: family.name, side: family.side }
      : null,
    wedding: wedding
      ? {
          ...details(wedding),
          version: wedding.__v,
          updatedAt: wedding.updatedAt.toISOString(),
        }
      : null,
    role: wedding ? roleFor(wedding, userId) : null,
  };
}

export function createWeddingRouter() {
  const router = Router();

  //guest website
  router.get("/public/weddings/:publicId", async (req, res) => {
    const wedding = await Wedding.findOne({ publicId: req.params.publicId });
    if (!wedding)
      throw httpError(
        404,
        "WEDDING_NOT_FOUND",
        "This wedding website could not be found.",
      );
    res.json({ data: details(wedding) });
  });

  const privatePaths = ["/setup", "/dashboard", "/families", "/weddings"];
  router.use(privatePaths, createSessionMiddleware());
  router.use(privatePaths, async (req, _res, next) => {
    if (
      !req.session.userId ||
      !(await User.exists({ _id: req.session.userId }))
    )
      throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
    next();
  });

  router.get("/setup", async (req, res) => {
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "members.userId": userId });
    const family = wedding
      ? await Family.findById(wedding.family)
      : await Family.findOne({ owner: userId });
    res.json({ data: workspaceData(wedding, family, userId) });
  });
  router.get("/dashboard", async (req, res) => {
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "members.userId": userId });
    if (!wedding) {
      res.status(409).json({
        error: {
          code: "WEDDING_REQUIRED",
          message: "Create your wedding to open the dashboard.",
          redirectTo: "/app/setup",
        },
      });
      return;
    }
    const family = await Family.findById(wedding.family);
    res.json({ data: workspaceData(wedding, family, userId) });
  });
  router.post("/families", checkCsrf, async (req, res) => {
    const input = familyInput.safeParse(req.body);
    if (!input.success)
      throw httpError(422, "INVALID_INPUT", input.error.issues[0].message);
    const userId = req.session.userId!;
    if (await Wedding.exists({ "members.userId": userId }))
      throw httpError(
        409,
        "WEDDING_EXISTS",
        "You already belong to a wedding.",
      );
    let family;
    try {
      family = await Family.create({ ...input.data, owner: userId });
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      )
        throw httpError(
          409,
          "FAMILY_EXISTS",
          "Your family is already registered.",
        );
      throw error;
    }
    // A team invitation may have been accepted while the family was saved.
    const wedding = await Wedding.findOne({ "members.userId": userId });
    const currentFamily = wedding
      ? await Family.findById(wedding.family)
      : family;
    res
      .status(201)
      .json({ data: workspaceData(wedding, currentFamily, userId) });
  });
  router.post("/weddings", checkCsrf, async (req, res) => {
    const input = weddingInput.safeParse(req.body);
    if (!input.success)
      throw httpError(422, "INVALID_INPUT", input.error.issues[0].message);
    checkCoordinates(input.data);
    const family = await Family.findOne({ owner: req.session.userId });
    if (!family)
      throw httpError(409, "FAMILY_REQUIRED", "Register your family first.");
    if (await Wedding.exists({ "members.userId": req.session.userId }))
      throw httpError(
        409,
        "WEDDING_EXISTS",
        "You already belong to a wedding.",
      );
    let wedding;
    try {
      wedding = await Wedding.create({
        ...input.data,
        family: family.id,
        createdBy: req.session.userId,
        members: [{ userId: req.session.userId, role: "Admin" }],
      });
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      )
        throw httpError(
          409,
          "WEDDING_EXISTS",
          "Your wedding is already registered.",
        );
      throw error;
    }
    res
      .status(201)
      .json({ data: workspaceData(wedding, family, req.session.userId!) });
  });
  router.patch("/weddings/current", checkCsrf, async (req, res) => {
    const userId = req.session.userId!;
    const wedding = await Wedding.findOne({ "members.userId": userId });
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "Create your wedding to open the dashboard.",
      );
    if (!canOrganize(roleFor(wedding, req.session.userId!)))
      throw httpError(
        403,
        "FORBIDDEN",
        "Only wedding organizers can edit these details.",
      );
    const input = weddingInput
      .extend({ version: z.number().int().min(0) })
      .safeParse(req.body);
    if (!input.success)
      throw httpError(422, "INVALID_INPUT", input.error.issues[0].message);
    const { version, ...values } = input.data;
    checkCoordinates(values);
    const updated = await Wedding.findOneAndUpdate(
      {
        _id: wedding._id,
        __v: version,
        members: {
          $elemMatch: {
            userId: req.session.userId,
            role: { $in: ["Admin", "Organizer"] },
          },
        },
      },
      { $set: values, $inc: { __v: 1 } },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated)
      throw httpError(
        409,
        "WEDDING_CONFLICT",
        "These details changed in another tab. Reload the latest details before saving.",
      );
    const family = await Family.findById(updated.family);
    res.json({ data: workspaceData(updated, family, userId) });
  });
  return router;
}
