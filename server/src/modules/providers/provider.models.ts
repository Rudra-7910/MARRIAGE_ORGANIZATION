import mongoose from "mongoose";
export const providerCategories = [
  "catering",
  "photography",
  "decoration",
  "lighting",
  "tent",
  "music",
] as const;
const providerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    category: { type: String, enum: providerCategories, required: true },
    description: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point", required: true },
      coordinates: { type: [Number], required: true },
    },
    googlePlaceId: { type: String, default: "" },
    serviceRadiusKm: { type: Number, required: true },
    availability: { type: String, default: "" },
    portfolioUrls: [String],
    published: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    moderationReason: { type: String, default: "" },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId },
    moderatedAt: Date,
  },
  { timestamps: true },
);
providerSchema.index({ location: "2dsphere" });
providerSchema.index({ published: 1, hidden: 1, category: 1, createdAt: -1 });
export type ProviderFields = mongoose.InferSchemaType<typeof providerSchema>;
export const Provider = mongoose.model("Provider", providerSchema);
const reviewSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    wedding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wedding",
      required: true,
    },
    department: { type: mongoose.Schema.Types.ObjectId, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    hidden: { type: Boolean, default: false },
    moderationReason: { type: String, default: "" },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId },
    moderatedAt: Date,
  },
  { timestamps: true },
);
reviewSchema.index({ provider: 1, hidden: 1, createdAt: -1 });
reviewSchema.index(
  { wedding: 1, department: 1, provider: 1 },
  { unique: true },
);
export const Review = mongoose.model("Review", reviewSchema);
