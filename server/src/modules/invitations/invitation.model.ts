import mongoose from "mongoose";

// One invitation per guest/family in V1. Store the exact email before sending it.
// This makes a retry safe even when wedding details change after the first attempt.
const invitationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    leaseId: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    status: {
      type: String,
      enum: ["sending", "submitted", "failed", "unconfirmed"],
      required: true,
    },
    firstAttemptAt: { type: Date, required: true },
    lastAttemptAt: { type: Date, required: true },
    leaseUntil: { type: Date, required: true },
    uncertain: { type: Boolean, default: false },
    providerId: { type: String, default: "" },
    error: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
  },
  { _id: false },
);

const guestSchema = new mongoose.Schema(
  {
    wedding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wedding",
      required: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    side: { type: String, enum: ["Bride", "Groom", "Both"], required: true },
    invitation: { type: invitationSchema, default: null },
  },
  { timestamps: true },
);
guestSchema.index({ wedding: 1, createdAt: -1, _id: -1 });

export const Guest = mongoose.model("Guest", guestSchema);
