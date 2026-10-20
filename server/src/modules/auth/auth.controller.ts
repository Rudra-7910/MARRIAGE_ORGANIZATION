import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  cookieName,
  cookieOptions,
  csrfToken,
  startUserSession,
} from "./auth.session.js";
import { User } from "./user.model.js";
import { httpError } from "../../middleware/http-error.js";


//email validations by zod 
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address.");

  //password validations by zod 
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 bytes.",
  );

//signup Schema validations
const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
});
const loginSchema = z.object({
  email,
  password: z.string().min(1).max(1024),
});


// Never include the password hash in an API response.
function publicUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

// Unknown emails still perform a password comparison to reduce timing differences.
const dummyHash = bcrypt.hashSync("unused-login-comparison", 12);

export function getCsrf(req: Request, res: Response) {
  if (!req.session.csrfToken) req.session.csrfToken = csrfToken();
  res.json({ data: { token: req.session.csrfToken } });
}
export async function signup(req: Request, res: Response) {
  const result = signupSchema.safeParse(req.body);
  if (!result.success)
    throw httpError(
      422,
      "INVALID_INPUT",
      result.error.issues[0]?.message || "Check your signup details.",
    );
  const { name, email, password } = result.data;
  let user;
  try {
    // The model's save hook hashes this before MongoDB receives the document.
    user = await User.create({ name, email, passwordHash: password });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw httpError(
        409,
        "EMAIL_IN_USE",
        "An account already uses that email. Try logging in.",
      );
    }
    throw error;
  }
  await startUserSession(req, user.id);
  res.status(201).json({ data: publicUser(user) });
}
export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success)
    throw httpError(422, "INVALID_INPUT", "Enter a valid email and password.");
  const { email, password } = result.data;
  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !valid || Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  }
  await startUserSession(req, user.id);
  res.json({ data: publicUser(user) });
}
export async function me(req: Request, res: Response) {
  if (!req.session.userId)
    throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
  const user = await User.findById(req.session.userId);
  if (!user)
    throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
  res.json({ data: publicUser(user) });
}
export async function logout(req: Request, res: Response) {
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
  res.clearCookie(cookieName, cookieOptions);
  res.json({ data: null });
}
