import mongoose from "mongoose";

export const maxMoneyPaise = 100_000_000_000;
const money = { type: Number, min: 0, max: maxMoneyPaise, required: true };
const actor = {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, maxlength: 80 },
};
const paymentSchema = new mongoose.Schema({
  amountPaise: money,
  paidOn: { type: String, required: true }, // Calendar date, entered by the organizer.
  note: { type: String, default: "", maxlength: 200 },
  recordedBy: actor,
  recordedAt: { type: Date, required: true },
  recordedVersion: { type: Number, required: true },
  idempotencyKey: { type: String, required: true },
  requestHash: { type: String, required: true },
  voidedAt: { type: Date, default: null },
  voidedBy: { type: String, default: "", maxlength: 80 },
  voidedById: { type: mongoose.Schema.Types.ObjectId, default: null },
  voidReason: { type: String, default: "", maxlength: 200 },
});
const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  departmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  agreedPaise: money,
  notes: { type: String, default: "", maxlength: 1000 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  payments: [paymentSchema],
  voidedAt: { type: Date, default: null },
  voidedBy: { type: String, default: "", maxlength: 80 },
  voidedById: { type: mongoose.Schema.Types.ObjectId, default: null },
  voidReason: { type: String, default: "", maxlength: 200 },
});
const snapshotSchema = new mongoose.Schema(
  {
    title: String,
    departmentId: String,
    agreedPaise: Number,
    notes: String,
    budgetPaise: { type: Number, default: undefined },
  },
  { _id: false },
);
const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  expenseId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actor,
  at: { type: Date, required: true },
  before: { type: snapshotSchema, default: null },
  after: { type: snapshotSchema, default: null },
  reason: { type: String, default: "", maxlength: 200 },
});

// Embedded finance and membership let one atomic write check both access and version.
// The parent Wedding field is select:false, so other workspace reads never fetch money.
export const financeSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 0 },
    budgetPaise: { type: Number, min: 0, max: maxMoneyPaise, default: null },
    expenses: [expenseSchema],
    audit: [auditSchema],
  },
  { _id: false },
);
