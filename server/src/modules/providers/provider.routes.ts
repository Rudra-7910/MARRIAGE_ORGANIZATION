import type { WeddingDocument } from "../weddings/wedding.models.js";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import escapeStringRegexp from "escape-string-regexp";
import {
  requireUser,
  requireWedding,
  requireOrganizer,
} from "../../middleware/wedding-access.js";
import { httpError } from "../../middleware/error-handler.js";
import { createSessionMiddleware, checkCsrf } from "../auth/auth.session.js";
import { Wedding, canOrganize, roleFor } from "../weddings/wedding.models.js";
import { Provider, Review, providerCategories } from "./provider.models.js";
import type { ProviderFields } from "./provider.models.js";

const id = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid service ID.");
const providerInput = z
  .object({
    version: z.number().int().min(0),
    name: z.string().trim().min(2).max(120),
    category: z.enum(providerCategories),
    description: z.string().trim().min(20).max(2000),
    phone: z
      .string()
      .trim()
      .max(20)
      .refine(
        (value) => isPossiblePhoneNumber(value, "IN"),
        "Enter a valid phone number.",
      ),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    googlePlaceId: z.string().trim().max(300).default(""),
    serviceRadiusKm: z.number().int().min(1).max(1000),
    availability: z.string().trim().max(1000),
    portfolioUrls: z.array(z.url({ protocol: /^https$/ }).max(1000)).max(12),
    published: z.boolean(),
  })
  .strict();
const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(1000),
});
const pageInput = z.coerce.number().int().min(1).max(10000).default(1);
type Listing = ProviderFields & {
  _id: mongoose.Types.ObjectId;
  __v?: number;
  averageRating?: number;
  reviewCount?: number;
  distanceKm?: number;
};
function providerData(profile: Listing) {
  return {
    id: profile._id.toString(),
    ownerId: profile.ownerId.toString(),
    name: profile.name,
    category: profile.category,
    googlePlaceId: profile.googlePlaceId,
    description: profile.description,
    phone: profile.phone,
    address: profile.address,
    city: profile.city,
    latitude: profile.location!.coordinates[1],
    longitude: profile.location!.coordinates[0],
    serviceRadiusKm: profile.serviceRadiusKm,
    availability: profile.availability,
    portfolioUrls: profile.portfolioUrls,
    published: profile.published,
    version: profile.__v || 0,
    averageRating: profile.averageRating || 0,
    reviewCount: profile.reviewCount || 0,
    createdAt: profile.createdAt.toISOString(),
    distanceKm: profile.distanceKm,
  };
}
const ratingStages: mongoose.PipelineStage[] = [
  {
    $lookup: {
      from: "reviews",
      let: { providerId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$provider", "$$providerId"] },
                { $eq: ["$hidden", false] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            reviewCount: { $sum: 1 },
          },
        },
      ],
      as: "rating",
    },
  },
  {
    $addFields: {
      averageRating: { $ifNull: [{ $first: "$rating.averageRating" }, 0] },
      reviewCount: { $ifNull: [{ $first: "$rating.reviewCount" }, 0] },
    },
  },
  { $unset: "rating" },
];
export function createProviderRouter() {
  const router = Router();
  router.use(
    ["/providers", "/moderation"],
    createSessionMiddleware(),
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  router.get("/providers", async (req, res) => {
    const query = z
      .object({
        page: pageInput,
        search: z.string().trim().max(100).default(""),
        category: z.enum(["all", ...providerCategories]).default("all"),
        sort: z.enum(["rating", "newest"]).default("rating"),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
      })
      .strict()
      .refine(
        (value) =>
          (value.latitude === undefined) === (value.longitude === undefined),
        "Provide both coordinates.",
      )
      .parse(req.query);
    const filter: mongoose.QueryFilter<ProviderFields> = {
      published: true,
      hidden: false,
    };
    if (query.category !== "all") filter.category = query.category;
    if (query.search) {
      const search = { $regex: escapeStringRegexp(query.search), $options: "i" };
      filter.$or = [{ name: search }, { city: search }, { description: search }];
    }
    const stages: mongoose.PipelineStage[] = [];
    if (query.latitude === undefined) {
      stages.push({ $match: filter });
    } else {
      stages.push(
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [query.longitude!, query.latitude],
            },
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance: 1000000,
            query: filter,
          },
        },
        { $addFields: { distanceKm: { $divide: ["$distanceMeters", 1000] } } },
        { $match: { $expr: { $lte: ["$distanceKm", "$serviceRadiusKm"] } } },
      );
    }
    const [result] = await Provider.aggregate<{
      items: Listing[];
      count: { total: number }[];
    }>([
      ...stages,
      ...ratingStages,
      {
        $sort:
          query.sort === "newest"
            ? { createdAt: -1, _id: -1 }
            : { averageRating: -1, reviewCount: -1, createdAt: -1, _id: -1 },
      },
      {
        $facet: {
          count: [{ $count: "total" }],
          items: [{ $skip: (query.page - 1) * 12 }, { $limit: 12 }],
        },
      },
    ]);
    res.json({
      data: {
        providers: (result?.items || []).map(providerData),
        total: result?.count[0]?.total || 0,
        page: query.page,
        pageSize: 12,
      },
    });
  });
  router.get("/providers/me", requireUser, async (req, res) => {
    const [profile] = await Provider.aggregate<Listing>([
      { $match: { ownerId: new mongoose.Types.ObjectId(req.session.userId!) } },
      ...ratingStages,
    ]);
    res.json({
      data: {
        profile: profile
          ? {
              ...providerData(profile),
              hidden: profile.hidden,
              moderationReason: profile.moderationReason,
            }
          : null,
        canModerate: (process.env.PLATFORM_MODERATOR_USER_IDS || "")
          .split(",")
          .includes(req.session.userId!),
      },
    });
  });
  router.put("/providers/me", requireUser, checkCsrf, async (req, res) => {
    const { version, latitude, longitude, ...values } = providerInput.parse(
      req.body,
    );
    const stored = {
      ...values,
      location: { type: "Point" as const, coordinates: [longitude, latitude] },
    };
    const existing = await Provider.findOne({ ownerId: req.session.userId });
    let profile;
    if (existing) {
      profile = await Provider.findOneAndUpdate(
        { _id: existing._id, ownerId: req.session.userId, __v: version },
        { $set: stored, $inc: { __v: 1 } },
        { returnDocument: "after", runValidators: true },
      );
    } else if (version === 0) {
      try {
        profile = await Provider.create({
          ...stored,
          ownerId: req.session.userId,
        });
      } catch (error) {
        if (
          !(
            error instanceof mongoose.mongo.MongoServerError &&
            error.code === 11000
          )
        )
          throw error;
      }
    }
    if (!profile)
      throw httpError(
        409,
        "PROVIDER_CONFLICT",
        "Your profile changed. Reload before saving.",
      );
    res.json({
      data: {
        profile: {
          ...providerData(profile),
          hidden: profile.hidden,
          moderationReason: profile.moderationReason,
        },
      },
    });
  });
  router.get("/providers/:id", async (req, res) => {
    const providerId = id.parse(req.params.id);
    const [profile] = await Provider.aggregate<Listing>([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(providerId),
          published: true,
          hidden: false,
        },
      },
      ...ratingStages,
    ]);
    if (!profile)
      throw httpError(
        404,
        "NOT_FOUND",
        "This service profile is not available.",
      );
    const userId = req.session.userId;
    const wedding = userId
      ? await Wedding.findOne({ "members.userId": userId })
      : null;
    const eligible =
      wedding &&
      canOrganize(roleFor(wedding, userId!)) &&
      profile.ownerId.toString() !== userId
        ? (wedding.planning?.departments || [])
            .filter(
              (department) =>
                department.providerId?.toString() === providerId &&
                department.status === "Done",
            )
            .map((department) => ({
              departmentId: department._id.toString(),
              departmentName: department.name,
              weddingId: wedding.id,
            }))
        : [];
    const [reviews, existingReviews] = await Promise.all([
      Review.find({ provider: providerId, hidden: false })
        .sort({ createdAt: -1 })
        .limit(100),
      wedding
        ? Review.find({ provider: providerId, wedding: wedding._id }).select(
            "department",
          )
        : [],
    ]);
    const canReview = eligible.filter(
      (item) =>
        !existingReviews.some(
          (review) => review.department.toString() === item.departmentId,
        ),
    );
    res.json({
      data: {
        provider: providerData(profile),
        canReview,
        canModerate: Boolean(
          userId &&
            (process.env.PLATFORM_MODERATOR_USER_IDS || "")
              .split(",")
              .includes(userId),
        ),
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt.toISOString(),
          version: review.__v,
          canEdit: Boolean(
            userId &&
              review.author.toString() === userId &&
              eligible.some(
                (item) => item.departmentId === review.department.toString(),
              ),
          ),
        })),
      },
    });
  });
  router.post(
    "/providers/:id/add-to-wedding",
    requireUser,
    requireWedding,
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      z.object({}).strict().parse(req.body);
      const providerId = id.parse(req.params.id);
      const profile = await Provider.findOne({
        _id: providerId,
        published: true,
        hidden: false,
      });
      if (!profile)
        throw httpError(404, "NOT_FOUND", "This service is not available.");
      const wedding = res.locals.wedding as WeddingDocument;
      const planning = wedding.planning!;
      const linked = planning.departments.find(
        (department) => department.providerId?.toString() === providerId,
      );
      if (linked) {
        res.json({ data: { departmentId: linked._id.toString() } });
        return;
      }
      if (planning.departments.length >= 40)
        throw httpError(
          409,
          "LIMIT_REACHED",
          "A wedding can have up to 40 departments.",
        );
      const departmentId = new mongoose.Types.ObjectId();
      planning.departments.push({
        _id: departmentId,
        providerId: profile._id,
        name: profile.name,
        kind: "Outside vendor",
        contactRole: profile.category,
        phone: profile.phone,
        notes: "Service found in the directory. Confirm arrangements directly.",
        memberIds: [],
      });
      // Department edits change planning.version independently of the wedding's __v.
      const updated = await Wedding.updateOne(
        {
          _id: wedding._id,
          __v: wedding.__v,
          "planning.version":
            wedding.planning?.version === 0
              ? { $in: [0, null] }
              : wedding.planning?.version,
          members: {
            $elemMatch: {
              userId: req.session.userId,
              role: { $in: ["Admin", "Organizer"] },
            },
          },
        },
        {
          $set: {
            "planning.departments": wedding.toObject().planning!.departments,
          },
          $inc: { __v: 1, "planning.version": 1 },
        },
      );
      if (!updated.matchedCount)
        throw httpError(
          409,
          "PLANNING_CONFLICT",
          "The plan changed. Reload before adding this service.",
        );
      res.status(201).json({ data: { departmentId: departmentId.toString() } });
    },
  );
  router.post(
    "/providers/:id/reviews",
    requireUser,
    requireWedding,
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      const values = reviewInput
        .extend({ departmentId: id })
        .strict()
        .parse(req.body);
      const providerId = id.parse(req.params.id);
      const wedding = res.locals.wedding as WeddingDocument;
      const department = wedding.planning?.departments.id(values.departmentId);
      const profile = await Provider.findOne({
        _id: providerId,
        published: true,
        hidden: false,
      });
      if (
        !profile ||
        profile.ownerId.toString() === req.session.userId ||
        !department ||
        department.status !== "Done" ||
        department.providerId?.toString() !== providerId
      )
        throw httpError(
          403,
          "REVIEW_NOT_ALLOWED",
          "Only organizers of a completed, linked service can review it.",
        );
      try {
        await mongoose.connection.transaction(async (session) => {
          const authorized = await Wedding.updateOne(
            {
              _id: wedding._id,
              __v: wedding.__v,
              "planning.version":
                wedding.planning?.version === 0
                  ? { $in: [0, null] }
                  : wedding.planning?.version,
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
              "REVIEW_CONFLICT",
              "The service or access changed. Reload before reviewing.",
            );
          await Review.create(
            [
              {
                provider: providerId,
                wedding: wedding._id,
                department: values.departmentId,
                author: req.session.userId,
                rating: values.rating,
                text: values.text,
              },
            ],
            { session },
          );
        });
      } catch (error) {
        if (
          error instanceof mongoose.mongo.MongoServerError &&
          error.code === 11000
        )
          throw httpError(
            409,
            "REVIEW_EXISTS",
            "This service has already been reviewed for your wedding.",
          );
        throw error;
      }
      res.status(201).json({ data: null });
    },
  );
  router.patch(
    "/providers/:id/reviews/:reviewId",
    requireUser,
    requireWedding,
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      const values = reviewInput
        .extend({ version: z.number().int().min(0) })
        .strict()
        .parse(req.body);
      const wedding = res.locals.wedding as WeddingDocument;
      const review = await Review.findOne({
        _id: id.parse(req.params.reviewId),
        provider: id.parse(req.params.id),
        wedding: wedding._id,
        author: req.session.userId,
      });
      const department =
        review && wedding.planning?.departments.id(review.department);
      if (
        !review ||
        !department ||
        department.status !== "Done" ||
        department.providerId?.toString() !== review.provider.toString()
      )
        throw httpError(
          403,
          "REVIEW_NOT_ALLOWED",
          "You cannot edit this review.",
        );
      await mongoose.connection.transaction(async (session) => {
        const authorized = await Wedding.updateOne(
          {
            _id: wedding._id,
            __v: wedding.__v,
            "planning.version":
              wedding.planning?.version === 0
                ? { $in: [0, null] }
                : wedding.planning?.version,
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
            "REVIEW_CONFLICT",
            "The service or access changed. Reload before saving.",
          );
        const updated = await Review.updateOne(
          { _id: review._id, __v: values.version, author: req.session.userId },
          {
            $set: { rating: values.rating, text: values.text },
            $inc: { __v: 1 },
          },
          { session },
        );
        if (!updated.matchedCount)
          throw httpError(
            409,
            "REVIEW_CONFLICT",
            "This review changed. Reload before saving.",
          );
      });
      res.json({ data: null });
    },
  );
  router.use("/moderation", requireUser, (req, _res, next) => {
    if (
      !(process.env.PLATFORM_MODERATOR_USER_IDS || "")
        .split(",")
        .includes(req.session.userId!)
    )
      throw httpError(
        403,
        "FORBIDDEN",
        "Platform moderator access is required.",
      );
    next();
  });
  router.get("/moderation", async (_req, res) => {
    const [profiles, reviews] = await Promise.all([
      Provider.find().sort({ updatedAt: -1 }).limit(100),
      Review.find().sort({ updatedAt: -1 }).limit(100),
    ]);
    res.json({
      data: {
        providers: profiles.map((profile) => ({
          ...providerData(profile),
          hidden: profile.hidden,
          moderationReason: profile.moderationReason,
        })),
        reviews: reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          text: review.text,
          createdAt: review.createdAt,
          version: review.__v,
          hidden: review.hidden,
          moderationReason: review.moderationReason,
        })),
      },
    });
  });
  router.patch("/moderation/:type/:id", checkCsrf, async (req, res) => {
    const type = z.enum(["providers", "reviews"]).parse(req.params.type);
    const values = z
      .object({ hidden: z.boolean(), reason: z.string().trim().max(500) })
      .strict()
      .refine(
        (value) => !value.hidden || value.reason.length >= 3,
        "Give a reason for hiding content.",
      )
      .parse(req.body);
    const filter = { _id: id.parse(req.params.id) };
    const update = {
      $set: {
        hidden: values.hidden,
        moderationReason: values.reason,
        moderatedBy: req.session.userId,
        moderatedAt: new Date(),
      },
      $inc: { __v: 1 },
    };
    const result =
      type === "providers"
        ? await Provider.updateOne(filter, update)
        : await Review.updateOne(filter, update);
    if (!result.matchedCount)
      throw httpError(404, "NOT_FOUND", "Content not found.");
    res.json({ data: null });
  });
  return router;
}
