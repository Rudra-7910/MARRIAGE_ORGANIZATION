import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import escapeStringRegexp from "escape-string-regexp";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { httpError } from "../../middleware/error-handler.js";
import { createSessionMiddleware, checkCsrf } from "../auth/auth.session.js";
import { User } from "../auth/user.model.js";
import { Wedding } from "../weddings/wedding.models.js";
import { Guest } from "./invitation.model.js";
import {
  invitationDefaults,
  renderInvitation,
  sendWithResend,
} from "./invitation.email.js";
import type { EmailSender, SendResult } from "./invitation.email.js";

const guestInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    side: z.enum(["Bride", "Groom", "Both"]),
  })
  .strict();

const versionInput = z.object({ version: z.number().int().min(0) }).strict();

const emailInput = versionInput
  .extend({
    weddingVersion: z.number().int().min(0),
    subject: z
      .string()
      .trim()
      .min(3)
      .max(240)
      .refine(
        (value) => !value.includes("\r") && !value.includes("\n"),
        "Subject must be a single line.",
      ),
    message: z.string().trim().min(1).max(3000),
  })
  .strict();
const leaseMs = 60000;
// Resend keeps idempotency keys for 24h. Stop earlier to allow for clock/network drift.
const retryWindowMs = 23 * 60 * 60 * 1000;

function guestDetails(guest: InstanceType<typeof Guest>) {
  const invitation = guest.invitation;
  let status = invitation?.status || "not_sent";
  // A crashed send can outlive its lease without a confirmed provider result.
  if (
    invitation &&
    status === "sending" &&
    invitation.leaseUntil.getTime() <= Date.now()
  ) {
    status = "unconfirmed";
  }
  const active =
    invitation &&
    invitation.leaseUntil.getTime() > Date.now() &&
    status === "sending";
  const inWindow =
    invitation &&
    Date.now() - invitation.firstAttemptAt.getTime() < retryWindowMs;
  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    side: guest.side,
    version: guest.__v,
    status,
    canEdit: !invitation || (status === "failed" && !invitation.uncertain),
    canRetry: Boolean(
      invitation &&
      !active &&
      (status === "failed" || (status === "unconfirmed" && inWindow)),
    ),
    lastAttemptAt: invitation?.lastAttemptAt.toISOString() || null,
    submittedAt: invitation?.submittedAt?.toISOString() || null,
    error:
      status === "unconfirmed"
        ? "Acceptance is unconfirmed. Check Resend before retrying. " +
          (inWindow
            ? "A retry reuses the exact email and its key."
            : "The safe retry window has expired; sending again is blocked to prevent duplicates.")
        : invitation?.error || "",
  };
}
export function createInvitationRouter(
  sendEmail: EmailSender = sendWithResend,
) {
  const router = Router();
  router.use(createSessionMiddleware());
  router.use(async (req, res, next) => {
    if (
      !req.session.userId ||
      !(await User.exists({ _id: req.session.userId }))
    )
      throw httpError(401, "UNAUTHENTICATED", "Please log in to continue.");
    const wedding = await Wedding.findOne({
      "members.userId": req.session.userId,
    });
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "Create your wedding before adding guests.",
      );
    if (
      !wedding.members.some(
        (member) =>
          member.userId.toString() === req.session.userId &&
          (member.role === "Admin" || member.role === "Organizer"),
      )
    )
      throw httpError(
        403,
        "FORBIDDEN",
        "Only this wedding’s organizers can manage guests and invitations.",
      );
    res.locals.wedding = wedding;
    next();
  });

  router.param("id", (_req, _res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id))
      throw httpError(404, "GUEST_NOT_FOUND", "This guest could not be found.");
    next();
  });

  router.get("/", async (req, res) => {
    const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
    const query = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        search: z.string().trim().max(100).default(""),
        side: z.enum(["All", "Bride", "Groom", "Both"]).default("All"),
      })
      .strict()
      .parse(req.query);
    const escapedSearch = escapeStringRegexp(query.search);
    const filter = {
      wedding: wedding._id,
      ...(query.side === "All" ? {} : { side: query.side }),
      ...(escapedSearch
        ? {
            $or: [
              { name: { $regex: escapedSearch, $options: "i" } },
              { email: { $regex: escapedSearch, $options: "i" } },
            ],
          }
        : {}),
    };
    const [guests, total, counts] = await Promise.all([
      Guest.find(filter)
        .select(
          "-invitation.html -invitation.text -invitation.from -invitation.key -invitation.leaseId",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * 20)
        .limit(20),
      Guest.countDocuments(filter),
      Guest.aggregate<{ _id: string | null; count: number }>([
        { $match: { wedding: wedding._id } },
        {
          $group: {
            _id: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$invitation.status", "sending"] },
                    { $lte: ["$invitation.leaseUntil", new Date()] },
                  ],
                },
                "unconfirmed",
                "$invitation.status",
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const summary = { total: 0, submitted: 0, attention: 0, notSent: 0 };
    for (const row of counts) {
      summary.total += row.count;
      if (row._id === "submitted") summary.submitted += row.count;
      if (row._id === "failed" || row._id === "unconfirmed")
        summary.attention += row.count;
      if (!row._id) summary.notSent += row.count;
    }
    res.json({
      data: {
        guests: guests.map(guestDetails),
        total,
        page: query.page,
        pageSize: 20,
        summary,
        emailConfigured: Boolean(env.resendApiKey && env.resendFrom),
      },
    });
  });
  router.post("/", checkCsrf, async (req, res) => {
    const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
    const values = guestInput.parse(req.body);
    const guest = await Guest.create({ ...values, wedding: wedding._id });
    res.status(201).json({ data: guestDetails(guest) });
  });
  router.patch("/:id", checkCsrf, async (req, res) => {
    const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
    const values = guestInput
      .extend({ version: z.number().int().min(0) })
      .strict()
      .parse(req.body);
    const guest = await Guest.findOne({
      _id: req.params.id,
      wedding: wedding._id,
    });
    if (!guest)
      throw httpError(404, "GUEST_NOT_FOUND", "This guest could not be found.");
    if (guest.__v !== values.version)
      throw httpError(
        409,
        "INVITATION_CONFLICT",
        "This guest or invitation changed. Reload it before continuing.",
      );
    if (!guestDetails(guest).canEdit)
      throw httpError(
        409,
        "INVITATION_LOCKED",
        "An invitation was already submitted or may be in progress. Its recipient cannot be changed.",
      );
    const updated = await Guest.findOneAndUpdate(
      { _id: guest._id, wedding: wedding._id, __v: values.version },
      {
        $set: {
          name: values.name,
          email: values.email,
          side: values.side,
          invitation: null,
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated)
      throw httpError(
        409,
        "INVITATION_CONFLICT",
        "This guest or invitation changed. Reload it before continuing.",
      );
    res.json({ data: guestDetails(updated) });
  });
  router.get("/:id/invitation", async (req, res) => {
    const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
    const guest = await Guest.findOne({
      _id: req.params.id,
      wedding: wedding._id,
    });
    if (!guest)
      throw httpError(404, "GUEST_NOT_FOUND", "This guest could not be found.");
    const draft = guest.invitation || invitationDefaults(wedding);
    const rendered =
      guest.invitation ||
      (await renderInvitation(wedding, guest, draft.subject, draft.message));
    res.json({
      data: {
        guest: guestDetails(guest),
        subject: draft.subject,
        message: draft.message,
        html: rendered.html,
        weddingVersion: wedding.__v,
        emailConfigured: Boolean(env.resendApiKey && env.resendFrom),
      },
    });
  });
  router.post("/:id/preview", checkCsrf, async (req, res) => {
    const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
    const values = emailInput.parse(req.body);
    const guest = await Guest.findOne({
      _id: req.params.id,
      wedding: wedding._id,
    });
    if (!guest)
      throw httpError(404, "GUEST_NOT_FOUND", "This guest could not be found.");
    if (guest.__v !== values.version || wedding.__v !== values.weddingVersion)
      throw httpError(
        409,
        "INVITATION_CONFLICT",
        "This guest or invitation changed. Reload it before continuing.",
      );
    if (guest.invitation)
      throw httpError(
        409,
        "INVITATION_LOCKED",
        "An existing attempt uses its saved email preview.",
      );
    res.json({
      data: await renderInvitation(
        wedding,
        guest,
        values.subject,
        values.message,
      ),
    });
  });

  const sendLimit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.session.userId!,
    message: {
      error: {
        code: "EMAIL_RATE_LIMITED",
        message: "Please wait a minute before sending more invitations.",
      },
    },
  });
  router.post(
    ["/:id/send", "/:id/retry"],
    checkCsrf,
    sendLimit,
    async (req, res) => {
      if (!env.resendApiKey || !env.resendFrom)
        throw httpError(
          503,
          "EMAIL_UNAVAILABLE",
          "Email sending is not configured. Add RESEND_API_KEY and RESEND_FROM to server/.env and restart the server.",
        );
      const wedding = res.locals.wedding as InstanceType<typeof Wedding>;
      const retry = req.path.endsWith("/retry") || req.path.endsWith("/retry/");
      const draft = retry ? null : emailInput.parse(req.body);
      const version = draft
        ? draft.version
        : versionInput.parse(req.body).version;
      const guest = await Guest.findOne({
        _id: req.params.id,
        wedding: wedding._id,
      });
      if (!guest)
        throw httpError(
          404,
          "GUEST_NOT_FOUND",
          "This guest could not be found.",
        );
      if (guest.__v !== version)
        throw httpError(
          409,
          "INVITATION_CONFLICT",
          "This guest or invitation changed. Reload it before continuing.",
        );
      const now = new Date();
      let invitation = guest.toObject().invitation;
      if (!draft) {
        if (!invitation || !guestDetails(guest).canRetry)
          throw httpError(
            409,
            "RETRY_UNAVAILABLE",
            "This invitation cannot be retried. Reload its status and check Resend if acceptance is unconfirmed.",
          );
        // A crashed process can leave a sending lease behind: treat it as uncertain.
        invitation.uncertain =
          invitation.uncertain ||
          invitation.status === "sending" ||
          invitation.status === "unconfirmed";
        if (Date.now() - invitation.firstAttemptAt.getTime() >= retryWindowMs) {
          if (invitation.uncertain)
            throw httpError(
              409,
              "RETRY_EXPIRED",
              "Check Resend: the safe retry window has expired.",
            );
          invitation.key = "wedding-invite/" + randomUUID();
          invitation.firstAttemptAt = now;
        }
        invitation.status = "sending";
        invitation.lastAttemptAt = now;
        invitation.leaseUntil = new Date(now.getTime() + leaseMs);
        invitation.leaseId = randomUUID();
        invitation.error = "";
      } else {
        if (wedding.__v !== draft.weddingVersion)
          throw httpError(
            409,
            "INVITATION_CONFLICT",
            "This guest or invitation changed. Reload it before continuing.",
          );
        if (invitation)
          throw httpError(
            409,
            "ALREADY_ATTEMPTED",
            "This invitation already has a send attempt. Reload its result; use Retry where available.",
          );
        invitation = {
          key: "wedding-invite/" + randomUUID(),
          leaseId: randomUUID(),
          from: env.resendFrom,
          to: guest.email,
          subject: draft.subject,
          message: draft.message,
          ...(await renderInvitation(
            wedding,
            guest,
            draft.subject,
            draft.message,
          )),
          status: "sending",
          firstAttemptAt: now,
          lastAttemptAt: now,
          leaseUntil: new Date(now.getTime() + leaseMs),
          uncertain: false,
          providerId: "",
          error: "",
          submittedAt: null,
        };
      }
      // The version condition atomically claims this guest across organizers and servers.
      const claimed = await Guest.findOneAndUpdate(
        { _id: guest._id, wedding: wedding._id, __v: version },
        { $set: { invitation }, $inc: { __v: 1 } },
        { returnDocument: "after", runValidators: true },
      );
      if (!claimed)
        throw httpError(
          409,
          "INVITATION_CONFLICT",
          "This guest or invitation changed. Reload it before continuing.",
        );
      let result: SendResult;
      try {
        result = await sendEmail(
          {
            from: invitation.from,
            to: invitation.to,
            subject: invitation.subject,
            html: invitation.html,
            text: invitation.text,
          },
          invitation.key,
        );
      } catch {
        result = {
          status: "unconfirmed",
          error:
            "The provider result is unknown. Check Resend before retrying.",
        };
      }
      const uncertain = result.status === "unconfirmed" || invitation.uncertain;
      const status =
        result.status === "failed" && uncertain ? "unconfirmed" : result.status;
      const finished = await Guest.findOneAndUpdate(
        {
          _id: guest._id,
          wedding: wedding._id,
          "invitation.leaseId": invitation.leaseId,
        },
        {
          $set: {
            "invitation.status": status,
            "invitation.uncertain": uncertain,
            "invitation.leaseUntil": new Date(),
            "invitation.providerId":
              result.status === "submitted" ? result.providerId : "",
            "invitation.submittedAt":
              result.status === "submitted" ? new Date() : null,
            "invitation.error":
              result.status === "submitted" ? "" : result.error,
          },
          $inc: { __v: 1 },
        },
        { returnDocument: "after", runValidators: true },
      );
      if (!finished)
        throw httpError(
          409,
          "INVITATION_CONFLICT",
          "This guest or invitation changed. Reload it before continuing.",
        );
      res.json({ data: guestDetails(finished) });
    },
  );
  return router;
}
