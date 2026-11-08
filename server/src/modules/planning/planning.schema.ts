import mongoose from "mongoose";

export const workStatuses = ["To do", "In progress", "Done"] as const;

// Both ceremony edits and function edits use the same IST interval rule.
export function hasScheduleConflict(
  wedding: { date: string; startTime: string; endTime: string },
  functions: { startsAt: string; endsAt: string }[],
) {
  const mainStart = Date.parse(
    wedding.date + "T" + wedding.startTime + ":00+05:30",
  );
  let mainEnd = wedding.endTime
    ? Date.parse(wedding.date + "T" + wedding.endTime + ":00+05:30")
    : mainStart + 1;
  if (mainEnd <= mainStart) mainEnd += 86400000;
  const intervals = [
    { start: mainStart, end: mainEnd },
    ...functions.map((item) => ({
      start: Date.parse(item.startsAt + ":00+05:30"),
      end: Date.parse(item.endsAt + ":00+05:30"),
    })),
  ].sort((a, b) => a.start - b.start);
  return intervals.some(
    (item, index) => index > 0 && item.start < intervals[index - 1].end,
  );
}

const functionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startsAt: { type: String, required: true }, // YYYY-MM-DDTHH:MM in IST
  endsAt: { type: String, required: true },
  venue: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  guestVisible: { type: Boolean, default: false },
});
const checklistSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, enum: workStatuses, default: "To do" },
});
const updateSchema = new mongoose.Schema({
  message: { type: String, required: true },
  actor: { type: String, required: true },
  at: { type: Date, default: Date.now },
  onBehalf: { type: Boolean, default: false },
});
const departmentSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "Provider", default: null },
  name: { type: String, required: true },
  kind: {
    type: String,
    enum: ["Family team", "Outside vendor"],
    default: "Family team",
  },
  contactRole: { type: String, default: "" },
  phone: { type: String, default: "" },
  notes: { type: String, default: "" },
  deadline: { type: String, default: "" }, // optional local IST datetime
  status: { type: String, enum: workStatuses, default: "To do" },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  checklist: [checklistSchema],
  addedAt: { type: Date, default: Date.now },
  lastProgressAt: { type: Date, default: Date.now },
  flag: {
    reason: { type: String, default: "" },
    raisedBy: { type: String, default: "" },
    raisedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  updates: [updateSchema],
});

// Bounded V1 planning data stays with membership for atomic permission/version checks.
export const planningSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 0 },
    staleAfterDays: { type: Number, default: 6 },
    functions: [functionSchema],
    departments: [departmentSchema],
  },
  { _id: false },
);
