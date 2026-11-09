import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
    },
    passwordHash: { type: String, required: true, select: false },
    sessionVersion: { type: Number, default: 0, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
    resetRequestedAt: { type: Date, select: false },
  },
  { timestamps: true },
);
// Expiry is checked by the reset command. A TTL index here would delete accounts.
userSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });

// User.create() and document.save() run this hook. Keep the existing database
// field so current accounts keep working; only hash when the password changes.
userSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

export const User = mongoose.model("User", userSchema);

export type UserDocument = InstanceType<typeof User>;
