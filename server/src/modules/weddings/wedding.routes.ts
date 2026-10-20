import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { Family, Wedding } from "./wedding.models.js";
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
    // End time can be after midnight for an Indian wedding.
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
async function currentWedding(req: Request) {
  return Wedding.findOne({ "members.userId": req.session.userId });
}
function requiredWeddingError() {
  return httpError(
    409,
    "WEDDING_REQUIRED",
    "Create your wedding to open the dashboard.",
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
function roleFor(wedding: InstanceType<typeof Wedding>, userId: string) {
  return wedding.members.find((member) => member.userId.toString() === userId)
    ?.role;
}
async function workspace(req: Request) {
  const wedding = await currentWedding(req);
  const family = wedding
    ? await Family.findById(wedding.family)
    : await Family.findOne({ owner: req.session.userId });
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
    role: wedding ? roleFor(wedding, req.session.userId!) : null,
  };
}
function duplicate(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export function createWeddingRouter() {
  const router = Router();
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
  router.get("/setup", async (req, res) =>
    res.json({ data: await workspace(req) }),
  );
  router.get("/dashboard", async (req, res) => {
    const data = await workspace(req);
    if (!data.wedding) {
      res.status(409).json({
        error: {
          code: "WEDDING_REQUIRED",
          message: "Create your wedding to open the dashboard.",
          redirectTo: "/app/setup",
        },
      });
      return;
    }
    res.json({ data });
  });
  router.post("/families", checkCsrf, async (req, res) => {
    const input = familyInput.safeParse(req.body);
    if (!input.success)
      throw httpError(422, "INVALID_INPUT", input.error.issues[0].message);
    if (await currentWedding(req))
      throw httpError(
        409,
        "WEDDING_EXISTS",
        "You already belong to a wedding.",
      );
    try {
      await Family.create({ ...input.data, owner: req.session.userId });
    } catch (error) {
      if (duplicate(error))
        throw httpError(
          409,
          "FAMILY_EXISTS",
          "Your family is already registered.",
        );
      throw error;
    }
    res.status(201).json({ data: await workspace(req) });
  });
  router.post("/weddings", checkCsrf, async (req, res) => {
    const input = weddingInput.safeParse(req.body);
    if (!input.success)
      throw httpError(422, "INVALID_INPUT", input.error.issues[0].message);
    checkCoordinates(input.data);
    const family = await Family.findOne({ owner: req.session.userId });
    if (!family)
      throw httpError(409, "FAMILY_REQUIRED", "Register your family first.");
    if (await currentWedding(req))
      throw httpError(
        409,
        "WEDDING_EXISTS",
        "You already belong to a wedding.",
      );
    try {
      await Wedding.create({
        ...input.data,
        family: family.id,
        createdBy: req.session.userId,
        members: [{ userId: req.session.userId, role: "Organizer" }],
      });
    } catch (error) {
      if (duplicate(error))
        throw httpError(
          409,
          "WEDDING_EXISTS",
          "Your wedding is already registered.",
        );
      throw error;
    }
    res.status(201).json({ data: await workspace(req) });
  });
  router.patch("/weddings/current", checkCsrf, async (req, res) => {
    const wedding = await currentWedding(req);
    if (!wedding) throw requiredWeddingError();
    if (roleFor(wedding, req.session.userId!) !== "Organizer")
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
          $elemMatch: { userId: req.session.userId, role: "Organizer" },
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
    res.json({ data: await workspace(req) });
  });
  return router;
}
