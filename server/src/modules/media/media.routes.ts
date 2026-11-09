import type { PhotoDocument, UploadGrantDocument } from "./media.models.js";
import type { WeddingDocument } from "../weddings/wedding.models.js";
import { Router } from "express";
import mongoose from "mongoose";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import QRCode from "qrcode";
import sharp from "sharp";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import {
  storage,
  storageConfigured,
  requireStorage,
  deleteMedia,
} from "../../config/storage.js";
import {
  requireUser,
  requireWedding,
  requireOrganizer,
} from "../../middleware/wedding-access.js";
import { httpError } from "../../middleware/error-handler.js";
import { checkCsrf, createSessionMiddleware } from "../auth/auth.session.js";
import { Wedding, canOrganize } from "../weddings/wedding.models.js";
import { UploadGrant, Photo } from "./media.models.js";
import { accessToken, tokenHash } from "../site/access-token.js";

const maxPhotoBytes = 10 * 1024 * 1024;
const pageInput = z.coerce.number().int().min(1).max(10000).default(1);
const id = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid photo ID.");
const uploadInput = z.object({ token: z.hex().length(64), publicId: z.uuid() });
let activeVerifications = 0;

async function uploadGrant(values: z.infer<typeof uploadInput>) {
  const wedding = await Wedding.findOne({ publicId: values.publicId }).select(
    "brideName groomName publicId",
  );
  const grant =
    wedding &&
    (await UploadGrant.findOne({
      wedding: wedding._id,
      tokenHash: tokenHash(values.token),
      revoked: false,
      expiresAt: { $gt: new Date() },
    }).select("+nonce"));
  if (
    !grant ||
    !wedding ||
    accessToken("upload", grant.id, grant.nonce) !== values.token
  )
    throw httpError(
      404,
      "UPLOAD_LINK_UNAVAILABLE",
      "This upload link has expired or was withdrawn. Ask an organizer for a new one.",
    );
  return { grant, wedding };
}
async function grantData(
  grant: UploadGrantDocument,
  publicId: string,
  includeQr = false,
) {
  const url =
    env.appOrigin +
    "/upload/" +
    publicId +
    "#" +
    accessToken("upload", grant.id, grant.nonce);
  let qrDataUrl: string | undefined;
  if (includeQr) {
    qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 });
  }
  return {
    id: grant.id,
    url,
    expiresAt: grant.expiresAt.toISOString(),
    limit: grant.limit,
    used: grant.used,
    revoked: grant.revoked,
    qrDataUrl,
  };
}
async function photoData(photo: PhotoDocument, preview: boolean) {
  let url: string | undefined;
  if (
    preview &&
    storageConfigured &&
    photo.bytes > 0 &&
    ["pending", "approved"].includes(photo.state)
  ) {
    url = await getSignedUrl(
      storage,
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: photo.reviewKey }),
      { expiresIn: 60 },
    );
  }
  return {
    id: photo.id,
    name: photo.name,
    state: photo.state,
    bytes: photo.bytes,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt.toISOString(),
    version: photo.__v,
    url,
  };
}
async function processPhoto(input: Buffer, contentType: string) {
  try {
    const image = sharp(input, {
      limitInputPixels: 40000000,
      animated: false,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    let detectedType = "";
    if (metadata.format === "jpeg") detectedType = "image/jpeg";
    else if (metadata.format === "png") detectedType = "image/png";
    else if (metadata.format === "webp") detectedType = "image/webp";
    if (
      !detectedType ||
      detectedType !== contentType ||
      (metadata.pages || 1) > 1
    )
      throw httpError(
        422,
        "INVALID_PHOTO",
        "Only still JPEG, PNG and WebP photos are supported.",
      );
    return await image
      .rotate()
      .resize({
        width: 3200,
        height: 3200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .timeout({ seconds: 30 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw httpError(
      422,
      "INVALID_PHOTO",
      "This file could not be read as a supported photo. Choose another JPEG, PNG or WebP.",
    );
  }
}

export function createMediaRouter() {
  const router = Router();
  const uploadLimit = rateLimit({
    windowMs: 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.use("/uploads", uploadLimit);
  router.post("/uploads/info", async (req, res) => {
    const { grant, wedding } = await uploadGrant(
      uploadInput.strict().parse(req.body),
    );
    res.json({
      data: {
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        expiresAt: grant.expiresAt,
        remaining: Math.max(0, grant.limit - grant.used),
        maxBytes: maxPhotoBytes,
        configured: storageConfigured,
      },
    });
  });
  router.post("/uploads/authorize", async (req, res) => {
    requireStorage();
    const values = uploadInput
      .extend({
        name: z.string().trim().min(1).max(150),
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().min(1).max(maxPhotoBytes),
      })
      .strict()
      .parse(req.body);
    const { grant, wedding } = await uploadGrant(values);
    const photoId = new mongoose.Types.ObjectId();
    const stagingKey =
      "staging/" + wedding.id + "/" + photoId + "/" + randomUUID();
    const reviewKey = "review/" + wedding.id + "/" + photoId + ".webp";
    const signed = await getSignedUrl(
      storage,
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: stagingKey,
        ContentType: values.type,
        ContentLength: values.size,
      }),
      { expiresIn: 90 },
    );
    await mongoose.connection.transaction(async (session) => {
      const reserved = await UploadGrant.updateOne(
        {
          _id: grant._id,
          revoked: false,
          expiresAt: { $gt: new Date() },
          $expr: { $lt: ["$used", "$limit"] },
        },
        { $inc: { used: 1, __v: 1 } },
        { session },
      );
      if (!reserved.matchedCount)
        throw httpError(
          409,
          "UPLOAD_LIMIT",
          "This link has no upload slots left, or is no longer active.",
        );
      await Photo.create(
        [
          {
            _id: photoId,
            wedding: wedding._id,
            grant: grant._id,
            name: values.name,
            type: values.type,
            expectedBytes: values.size,
            stagingKey,
            reviewKey,
          },
        ],
        { session },
      );
    });
    res.status(201).json({
      data: {
        id: photoId.toString(),
        uploadUrl: signed,
        headers: { "Content-Type": values.type },
      },
    });
  });
  router.post("/uploads/:id/authorize", async (req, res) => {
    requireStorage();
    const { grant } = await uploadGrant(uploadInput.strict().parse(req.body));
    const photo = await Photo.findOne({
      _id: id.parse(req.params.id),
      grant: grant._id,
      state: "uploading",
    }).select("+stagingKey");
    if (!photo)
      throw httpError(
        409,
        "PHOTO_BUSY",
        "This upload is already being processed. Refresh its status.",
      );
    const uploadUrl = await getSignedUrl(
      storage,
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: photo.stagingKey,
        ContentType: photo.type,
        ContentLength: photo.expectedBytes,
      }),
      { expiresIn: 90 },
    );
    res.json({
      data: {
        id: photo.id,
        uploadUrl,
        headers: { "Content-Type": photo.type },
      },
    });
  });
  router.post("/uploads/:id/complete", async (req, res) => {
    requireStorage();
    const photoId = id.parse(req.params.id);
    const { grant } = await uploadGrant(uploadInput.strict().parse(req.body));
    const existing = await Photo.findOne({
      _id: photoId,
      grant: grant._id,
    }).select("+reviewKey");
    if (!existing)
      throw httpError(404, "NOT_FOUND", "Upload not found for this link.");
    if (existing.state === "pending" || existing.state === "approved") {
      res.json({ data: { state: "pending" } });
      return;
    }
    // Bound CPU and memory on the single V1 server; callers can retry explicitly.
    if (activeVerifications >= 2)
      throw httpError(
        503,
        "PHOTO_BUSY",
        "Photos are being processed. Please retry in a moment.",
      );
    const leaseId = randomUUID();
    const photo = await Photo.findOneAndUpdate(
      {
        _id: photoId,
        grant: grant._id,
        __v: existing.__v,
        attempts: { $lt: 8 },
        $or: [
          { state: "uploading" },
          { state: "verifying", leaseUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          state: "verifying",
          leaseId,
          leaseUntil: new Date(Date.now() + 300000),
          reviewKey:
            "review/" +
            existing.wedding +
            "/" +
            photoId +
            "/" +
            leaseId +
            ".webp",
        },
        $push: { abandonedKeys: existing.reviewKey },
        $inc: { __v: 1, attempts: 1 },
      },
      { returnDocument: "after" },
    ).select("+stagingKey +reviewKey +abandonedKeys");
    if (!photo)
      throw httpError(
        409,
        "PHOTO_BUSY",
        "This photo is being processed or was already rejected.",
      );
    activeVerifications++;
    try {
      const head = await storage.send(
        new HeadObjectCommand({ Bucket: env.s3Bucket, Key: photo.stagingKey }),
      );
      if (
        !head.ContentLength ||
        head.ContentLength > maxPhotoBytes ||
        head.ContentLength !== photo.expectedBytes
      )
        throw httpError(
          422,
          "INVALID_PHOTO",
          "The uploaded image size did not match. Choose the file again.",
        );
      const object = await storage.send(
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: photo.stagingKey,
          Range: "bytes=0-" + maxPhotoBytes,
        }),
      );
      const input = Buffer.from(await object.Body!.transformToByteArray());
      if (input.length !== photo.expectedBytes || input.length > maxPhotoBytes)
        throw httpError(
          422,
          "INVALID_PHOTO",
          "Choose a JPEG, PNG or WebP image up to 10 MB.",
        );
      const output = await processPhoto(input, photo.type);
      await storage.send(
        new PutObjectCommand({
          Bucket: env.s3Bucket,
          Key: photo.reviewKey,
          Body: output.data,
          ContentType: "image/webp",
          ContentLength: output.data.length,
        }),
      );
      await mongoose.connection.transaction(async (session) => {
        // A write to the grant makes revocation race with completion safely.
        const active = await UploadGrant.updateOne(
          { _id: grant._id, revoked: false, expiresAt: { $gt: new Date() } },
          { $inc: { __v: 1 } },
          { session },
        );
        if (!active.matchedCount)
          throw httpError(
            409,
            "UPLOAD_LINK_UNAVAILABLE",
            "This upload link is no longer active.",
          );
        const completed = await Photo.updateOne(
          { _id: photo._id, state: "verifying", leaseId },
          {
            $set: {
              state: "pending",
              bytes: output.data.length,
              width: output.info.width,
              height: output.info.height,
              leaseUntil: null,
              cleanupPending: true,
            },
            $inc: { __v: 1 },
          },
          { session },
        );
        if (!completed.matchedCount)
          throw httpError(
            409,
            "PHOTO_CONFLICT",
            "This upload changed. Refresh its status.",
          );
      });
      try {
        await deleteMedia([photo.stagingKey, ...photo.abandonedKeys]);
        await Photo.updateOne(
          { _id: photo._id },
          { $set: { cleanupPending: false } },
        );
      } catch {
        /* Cleanup is retryable with the maintenance command; the image stays private. */
      }
      res.locals.weddingId = photo.wedding.toString();
      res.json({ data: { state: "pending" } });
    } catch (error) {
      const invalid = (error as { status?: number }).status === 422;
      await Photo.updateOne(
        { _id: photo._id, state: "verifying", leaseId },
        {
          $set: {
            state: invalid ? "rejected" : "uploading",
            leaseUntil: null,
            cleanupPending: invalid,
          },
          $inc: { __v: 1 },
        },
      );
      if (invalid)
        throw httpError(
          422,
          "INVALID_PHOTO",
          "This file could not be read as a supported photo. Choose another JPEG, PNG or WebP.",
        );
      if (typeof (error as { status?: number }).status === "number")
        throw error;
      throw httpError(
        503,
        "PHOTO_RETRY",
        "Could not finish processing this photo. Please retry in a moment.",
      );
    } finally {
      activeVerifications--;
    }
  });

  router.get("/public/weddings/:publicId/photos", async (req, res) => {
    const page = pageInput.parse(req.query.page);
    const wedding = await Wedding.findOne({
      publicId: req.params.publicId,
    }).select("_id");
    if (!wedding)
      throw httpError(404, "NOT_FOUND", "Wedding website not found.");
    const filter = { wedding: wedding._id, state: "approved" as const };
    const [photos, total] = await Promise.all([
      Photo.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 24)
        .limit(24),
      Photo.countDocuments(filter),
    ]);
    res.json({
      data: {
        page,
        total,
        pageSize: 24,
        photos: photos.map((photo) => ({
          id: photo.id,
          name: photo.name,
          width: photo.width,
          height: photo.height,
          url: "/api/v1/public/photos/" + photo.id + "/content",
          downloadUrl: "/api/v1/public/photos/" + photo.id + "/download",
        })),
      },
    });
  });
  router.get(
    ["/public/photos/:id/content", "/public/photos/:id/download"],
    async (req, res) => {
      requireStorage();
      const photo = await Photo.findOne({
        _id: id.parse(req.params.id),
        state: "approved",
      }).select("+reviewKey");
      if (!photo)
        throw httpError(404, "NOT_FOUND", "This photo is no longer published.");
      const download = req.path.endsWith("/download");
      const url = await getSignedUrl(
        storage,
        new GetObjectCommand({
          Bucket: env.s3Bucket,
          Key: photo.reviewKey,
          ResponseContentDisposition:
            (download ? "attachment" : "inline") +
            '; filename="wedding-photo-' +
            photo.id +
            '.webp"',
          ResponseContentType: "image/webp",
        }),
        { expiresIn: 60 },
      );
      res.redirect(302, url);
    },
  );

  const staffPaths = [
    "/weddings/current/photos",
    "/weddings/current/upload-links",
  ];
  router.use(
    staffPaths,
    createSessionMiddleware(),
    requireUser,
    requireWedding,
  );
  router.get("/weddings/current/photos", async (req, res) => {
    const { page, state } = z
      .object({
        page: pageInput,
        state: z.enum(["pending", "approved", "rejected"]).default("approved"),
      })
      .strict()
      .parse(req.query);
    const wedding = res.locals.wedding as WeddingDocument;
    const organizer = canOrganize(res.locals.role);
    if (!organizer && state !== "approved")
      throw httpError(
        403,
        "FORBIDDEN",
        "Only organizers can review private photos.",
      );
    const filter = { wedding: wedding._id, state };
    const [photos, total, grants] = await Promise.all([
      Photo.find(filter)
        .select("+reviewKey")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 24)
        .limit(24),
      Photo.countDocuments(filter),
      organizer
        ? UploadGrant.find({ wedding: wedding._id })
            .select("+nonce")
            .sort({ revoked: 1, expiresAt: -1 })
            .limit(100)
        : [],
    ]);
    res.json({
      data: {
        photos: await Promise.all(
          photos.map((photo) => photoData(photo, true)),
        ),
        total,
        page,
        pageSize: 24,
        canModerate: organizer,
        configured: storageConfigured,
        grants: await Promise.all(
          grants.map((grant) => grantData(grant, wedding.publicId)),
        ),
      },
    });
  });
  router.get(
    "/weddings/current/upload-links/:id",
    requireOrganizer,
    async (req, res) => {
      const wedding = res.locals.wedding as WeddingDocument;
      const grant = await UploadGrant.findOne({
        _id: id.parse(req.params.id),
        wedding: wedding._id,
      }).select("+nonce");
      if (!grant) throw httpError(404, "NOT_FOUND", "Upload link not found.");
      res.json({ data: await grantData(grant, wedding.publicId, true) });
    },
  );
  router.post(
    "/weddings/current/upload-links",
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      requireStorage();
      const { days, limit } = z
        .object({
          days: z.number().int().min(1).max(365),
          limit: z.number().int().min(1).max(1000),
        })
        .strict()
        .parse(req.body);
      const wedding = res.locals.wedding as WeddingDocument;
      const grantId = new mongoose.Types.ObjectId();
      const nonce = randomBytes(16).toString("hex");
      const grant = await mongoose.connection.transaction(async (session) => {
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
            "Wedding access changed. Reload and try again.",
          );
        if (
          (await UploadGrant.countDocuments({
            wedding: wedding._id,
            revoked: false,
            expiresAt: { $gt: new Date() },
          }).session(session)) >= 30
        )
          throw httpError(
            409,
            "LINK_LIMIT",
            "Revoke an unused photo link before creating another.",
          );
        const [created] = await UploadGrant.create(
          [
            {
              _id: grantId,
              wedding: wedding._id,
              nonce,
              tokenHash: tokenHash(
                accessToken("upload", grantId.toString(), nonce),
              ),
              expiresAt: new Date(Date.now() + days * 86400000),
              limit,
              createdBy: req.session.userId,
            },
          ],
          { session },
        );
        return created!;
      });
      res
        .status(201)
        .json({ data: await grantData(grant, wedding.publicId, true) });
    },
  );
  router.delete(
    "/weddings/current/upload-links/:id",
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      const wedding = res.locals.wedding as WeddingDocument;
      await mongoose.connection.transaction(async (session) => {
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
            "Wedding access changed. Reload and try again.",
          );
        const grant = await UploadGrant.updateOne(
          { _id: id.parse(req.params.id), wedding: wedding._id },
          { $set: { revoked: true }, $inc: { __v: 1 } },
          { session },
        );
        if (!grant.matchedCount)
          throw httpError(404, "NOT_FOUND", "Upload link not found.");
      });
      res.json({ data: null });
    },
  );
  router.patch(
    "/weddings/current/photos/:id",
    requireOrganizer,
    checkCsrf,
    async (req, res) => {
      const { action, version } = z
        .object({
          action: z.enum(["approve", "reject", "unpublish"]),
          version: z.number().int().min(0),
        })
        .strict()
        .parse(req.body);
      const wedding = res.locals.wedding as WeddingDocument;
      const photo = await mongoose.connection.transaction(async (session) => {
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
            "Wedding access changed. Reload and try again.",
          );
        const updated = await Photo.findOneAndUpdate(
          {
            _id: id.parse(req.params.id),
            wedding: wedding._id,
            __v: version,
            state: action === "unpublish" ? "approved" : "pending",
          },
          {
            $set: {
              state:
                action === "approve"
                  ? "approved"
                  : action === "unpublish"
                    ? "pending"
                    : "rejected",
              moderatedBy: req.session.userId,
              moderatedAt: new Date(),
              ...(action === "reject" ? { cleanupPending: true } : {}),
            },
            $inc: { __v: 1 },
          },
          { session, returnDocument: "after" },
        ).select("+reviewKey +stagingKey +abandonedKeys");
        if (!updated)
          throw httpError(
            409,
            "PHOTO_CONFLICT",
            "This photo changed. Reload before reviewing it.",
          );
        return updated;
      });
      if (action === "reject" && storageConfigured) {
        try {
          await deleteMedia([
            photo.stagingKey,
            photo.reviewKey,
            ...photo.abandonedKeys,
          ]);
          await Photo.updateOne(
            { _id: photo._id },
            { $set: { cleanupPending: false } },
          );
        } catch {
          /* Retain a retry marker instead of pretending storage deletion succeeded. */
        }
      }
      res.json({ data: await photoData(photo, action !== "reject") });
    },
  );
  return router;
}
