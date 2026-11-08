import mongoose from "mongoose";

const grantSchema = new mongoose.Schema(
  {
    wedding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wedding",
      required: true,
    },
    nonce: { type: String, required: true, select: false },
    tokenHash: { type: String, required: true, select: false, unique: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    limit: { type: Number, required: true },
    used: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
grantSchema.index({ wedding: 1, createdAt: -1 });
export const UploadGrant = mongoose.model("UploadGrant", grantSchema);

const photoSchema = new mongoose.Schema(
  {
    wedding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wedding",
      required: true,
    },
    grant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadGrant",
      required: true,
    },
    name: { type: String, required: true },
    type: { type: String, required: true },
    state: {
      type: String,
      enum: ["uploading", "verifying", "pending", "approved", "rejected"],
      default: "uploading",
    },
    stagingKey: { type: String, required: true, select: false },
    reviewKey: { type: String, required: true, select: false },
    abandonedKeys: { type: [String], default: [], select: false },
    attempts: { type: Number, default: 0 },
    expectedBytes: { type: Number, required: true },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    leaseId: { type: String, default: "" },
    leaseUntil: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    moderatedAt: { type: Date, default: null },
    cleanupPending: { type: Boolean, default: false },
  },
  { timestamps: true },
);
photoSchema.index({ wedding: 1, state: 1, createdAt: -1, _id: -1 });
photoSchema.index({ grant: 1 });
export const Photo = mongoose.model("Photo", photoSchema);
