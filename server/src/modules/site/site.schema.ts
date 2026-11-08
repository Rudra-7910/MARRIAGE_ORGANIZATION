import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  scope: { type: String, enum: ["public", "functions"], required: true },
  functionIds: [{ type: mongoose.Schema.Types.ObjectId }],
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
export const siteSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 0 },
    announcements: [announcementSchema],
  },
  { _id: false },
);
