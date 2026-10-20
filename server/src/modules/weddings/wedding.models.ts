import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

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
          enum: ["Organizer", "Manager", "Worker"],
          required: true,
        },
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
export const Family = mongoose.model("Family", familySchema);
export const Wedding = mongoose.model("Wedding", weddingSchema);
