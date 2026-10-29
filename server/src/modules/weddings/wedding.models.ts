import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

export const weddingRoles = [
  "Admin",
  "Organizer",
  "Manager",
  "Worker",
] as const;

export function canOrganize(role: string | null | undefined) {
  return role === "Admin" || role === "Organizer";
}

const familySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    side: { type: String, enum: ["Bride", "Groom", "Both"], required: true },
  },
  { timestamps: true },
);

const weddingSchema = new mongoose.Schema(
  {
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    publicId: {
      type: String,
      default: randomUUID,
      unique: true,
      immutable: true,
    },
    members: [
      {
        _id: false,
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: weddingRoles,
          required: true,
        },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    // Kept with membership so accepting a link is one atomic document update.
    // Never apply a TTL index here: that would delete the wedding itself.
    teamInvites: [
      {
        tokenHash: { type: String, required: true },
        role: { type: String, enum: weddingRoles, required: true },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        acceptedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        acceptedAt: { type: Date, default: null },
      },
    ],
    brideName: { type: String, required: true, trim: true },
    groomName: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, default: "" },
    venue: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    contactRole: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    welcome: { type: String, default: "" },
    youtube: { type: String, default: "" },
  },
  { timestamps: true },
);

// V1: a person participates in one wedding space.
weddingSchema.index({ "members.userId": 1 }, { unique: true });
weddingSchema.index({ "teamInvites.tokenHash": 1 });
export const Family = mongoose.model("Family", familySchema);
export const Wedding = mongoose.model("Wedding", weddingSchema);

export function roleFor(wedding: InstanceType<typeof Wedding>, userId: string) {
  const member = wedding.members.find(
    (item) => item.userId.toString() === userId,
  );
  if (!member) return undefined;
  // Older weddings stored their creator as Organizer. No data migration needed.
  return wedding.createdBy.toString() === userId ? "Admin" : member.role;
}
