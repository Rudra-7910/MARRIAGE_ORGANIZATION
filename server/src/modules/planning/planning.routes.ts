import type { WeddingDocument } from "../weddings/wedding.models.js";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { isPossiblePhoneNumber } from "libphonenumber-js";
import { checkCsrf, createSessionMiddleware } from "../auth/auth.session.js";
import type { UserDocument } from "../auth/user.model.js";
import { requireUser } from "../../middleware/wedding-access.js";
import { Wedding, canOrganize, roleFor } from "../weddings/wedding.models.js";
import { httpError } from "../../middleware/error-handler.js";
import { hasScheduleConflict, workStatuses } from "./planning.schema.js";

const id = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid record ID.");
const localTime = z.iso.datetime({ local: true, precision: -1 }).length(16);
const base = z.object({ version: z.number().int().min(0) });
const functionInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    startsAt: localTime,
    endsAt: localTime,
    venue: z.string().trim().min(2).max(160),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(100),
    guestVisible: z.boolean(),
  })
  .strict()
  .refine((value) => value.endsAt > value.startsAt, {
    message: "End time must be after start time.",
    path: ["endsAt"],
  });
const departmentInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    kind: z.enum(["Family team", "Outside vendor"]),
    contactRole: z.string().trim().max(100),
    phone: z
      .string()
      .trim()
      .max(20)
      .refine(
        (value) => !value || isPossiblePhoneNumber(value, "IN"),
        "Enter a valid phone number.",
      ),
    notes: z.string().trim().max(2000),
    deadline: z.union([z.literal(""), localTime]),
    memberIds: z.array(id).max(200),
  })
  .strict();
const commandInput = z.discriminatedUnion("action", [
  base
    .extend({ action: z.literal("addFunction"), values: functionInput })
    .strict(),
  base
    .extend({ action: z.literal("editFunction"), id, values: functionInput })
    .strict(),
  base.extend({ action: z.literal("removeFunction"), id }).strict(),
  base
    .extend({ action: z.literal("addDepartment"), values: departmentInput })
    .strict(),
  base
    .extend({
      action: z.literal("editDepartment"),
      id,
      values: departmentInput,
    })
    .strict(),
  base.extend({ action: z.literal("removeDepartment"), id }).strict(),
  base.extend({ action: z.literal("applyTemplate") }).strict(),
  base
    .extend({
      action: z.literal("updateSettings"),
      staleAfterDays: z.number().int().min(1).max(30),
    })
    .strict(),
  base
    .extend({
      action: z.literal("updateWork"),
      id,
      status: z.enum(workStatuses),
      note: z.string().trim().max(2000),
      onBehalf: z.boolean(),
    })
    .strict(),
  base
    .extend({
      action: z.literal("addChecklistItem"),
      id,
      title: z.string().trim().min(2).max(160),
    })
    .strict(),
  base
    .extend({
      action: z.literal("updateChecklistItem"),
      id,
      itemId: id,
      status: z.enum(workStatuses),
    })
    .strict(),
  base
    .extend({ action: z.literal("removeChecklistItem"), id, itemId: id })
    .strict(),
  base
    .extend({
      action: z.literal("raiseAttention"),
      id,
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  base.extend({ action: z.literal("resolveAttention"), id }).strict(),
]);

// Explicit allowlist: other departments expose progress, never private notes/history.
function planningData(wedding: WeddingDocument, userId: string) {
  const planning = wedding.planning!;
  const organizer = canOrganize(roleFor(wedding, userId));
  const now = Date.now();
  return {
    version: planning.version,
    staleAfterDays: planning.staleAfterDays,
    canManage: organizer,
    functions: planning.functions
      .map((item) => ({
        id: item._id.toString(),
        name: item.name,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        venue: item.venue,
        address: item.address,
        city: item.city,
        guestVisible: item.guestVisible,
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    departments: planning.departments.map((item) => {
      const canEdit =
        organizer ||
        item.memberIds.some((member) => member.toString() === userId);
      const reasons: string[] = [];
      if (item.flag?.reason && !item.flag.resolvedAt)
        reasons.push(
          canEdit ? item.flag.reason : "Organizer attention requested",
        );
      if (item.status !== "Done") {
        if (item.deadline && Date.parse(item.deadline + ":00+05:30") < now)
          reasons.push("Deadline has passed");
        if (
          now - item.lastProgressAt.getTime() >=
          planning.staleAfterDays * 86400000
        )
          reasons.push(
            "No progress update for " + planning.staleAfterDays + " days",
          );
      }
      const progress = {
        id: item._id.toString(),
        name: item.name,
        kind: item.kind,
        status: item.status,
        contactRole: item.contactRole,
        phone: item.phone,
        deadline: item.deadline,
        lastProgressAt: item.lastProgressAt.toISOString(),
        completed: item.checklist.filter((task) => task.status === "Done")
          .length,
        total: item.checklist.length,
        attentionReasons: reasons,
        hasManualFlag: Boolean(item.flag?.reason && !item.flag.resolvedAt),
        canEdit,
        canManage: organizer,
      };
      if (!canEdit) return progress;
      return {
        ...progress,
        notes: item.notes,
        memberIds: item.memberIds.map((member) => member.toString()),
        checklist: item.checklist.map((task) => ({
          id: task._id.toString(),
          title: task.title,
          status: task.status,
        })),
        updates: item.updates
          .map((update) => ({
            id: update._id.toString(),
            message: update.message,
            actor: update.actor,
            at: update.at.toISOString(),
            onBehalf: update.onBehalf,
          }))
          .reverse(),
      };
    }),
  };
}

export function createPlanningRouter() {
  const router = Router();
  router.use(createSessionMiddleware(), requireUser);
  router.use(async (_req, res, next) => {
    const user = res.locals.user as UserDocument;
    const wedding = await Wedding.findOne({ "members.userId": user.id });
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "Create or join a wedding first.",
      );
    res.locals.wedding = wedding;
    res.locals.actor = user.name;
    next();
  });
  router.get("/", (req, res) => {
    res.json({ data: planningData(res.locals.wedding, req.session.userId!) });
  });

  // One typed command per request; one atomic write for membership + plan version.
  router.patch("/", checkCsrf, async (req, res) => {
    const command = commandInput.parse(req.body);
    const wedding = res.locals.wedding as WeddingDocument;
    const planning = wedding.planning!;
    const userId = req.session.userId!;
    const role = roleFor(wedding, userId);
    const organizer = canOrganize(role);
    if (planning.version !== command.version)
      throw httpError(
        409,
        "PLANNING_CONFLICT",
        "The plan changed. Reload the latest plan before saving.",
      );

    const workActions = [
      "updateWork",
      "addChecklistItem",
      "updateChecklistItem",
      "removeChecklistItem",
      "raiseAttention",
      "resolveAttention",
    ];
    const department =
      "id" in command ? planning.departments.id(command.id) : null;
    if (workActions.includes(command.action)) {
      if (!department)
        throw httpError(
          404,
          "NOT_FOUND",
          "Department not found in your wedding.",
        );
      if (
        !organizer &&
        !department.memberIds.some((member) => member.toString() === userId)
      )
        throw httpError(
          403,
          "FORBIDDEN",
          "You can update only your assigned department.",
        );
      if (
        (command.action === "resolveAttention" ||
          command.action === "removeChecklistItem") &&
        !organizer
      )
        throw httpError(
          403,
          "FORBIDDEN",
          "Only organizers can resolve flags or remove checklist items.",
        );
    } else if (!organizer) {
      throw httpError(
        403,
        "FORBIDDEN",
        "Only organizers can manage wedding plans and department access.",
      );
    }

    if (
      command.action === "addDepartment" ||
      command.action === "editDepartment"
    ) {
      const members = new Set(
        wedding.members.map((member) => member.userId.toString()),
      );
      if (
        command.values.memberIds.some((member) => !members.has(member)) ||
        new Set(command.values.memberIds).size !==
          command.values.memberIds.length
      )
        throw httpError(
          422,
          "INVALID_INPUT",
          "Assign only unique members of this wedding.",
        );
    }

    const now = new Date();
    const actor = res.locals.actor as string;
    switch (command.action) {
      case "addFunction":
        if (planning.functions.length >= 50)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "A wedding can have up to 50 additional functions.",
          );
        planning.functions.push(command.values);
        break;
      case "editFunction": {
        const item = planning.functions.id(command.id);
        if (!item)
          throw httpError(
            404,
            "NOT_FOUND",
            "Function not found in your wedding.",
          );
        item.set(command.values);
        break;
      }
      case "removeFunction": {
        const item = planning.functions.id(command.id);
        if (!item)
          throw httpError(
            404,
            "NOT_FOUND",
            "Function not found in your wedding.",
          );
        item.deleteOne();
        break;
      }
      case "addDepartment":
        if (planning.departments.length >= 40)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "A wedding can have up to 40 departments.",
          );
        planning.departments.push({
          ...command.values,
          updates: [{ actor, at: now, message: "Department added" }],
        });
        break;
      case "editDepartment": {
        if (!department)
          throw httpError(
            404,
            "NOT_FOUND",
            "Department not found in your wedding.",
          );
        department.set(command.values);
        department.updates.push({
          actor,
          at: now,
          message: "Department details updated",
        });
        break;
      }
      case "removeDepartment":
        if (!department)
          throw httpError(
            404,
            "NOT_FOUND",
            "Department not found in your wedding.",
          );
        department.deleteOne();
        break;
      case "applyTemplate": {
        const templates = [
          {
            name: "Venue",
            tasks: [
              "Confirm the venue and entrance",
              "Check ceremony timings with the family",
            ],
          },
          {
            name: "Catering",
            tasks: [
              "Confirm menu and meal timings",
              "Share the family's guest estimate",
            ],
          },
          {
            name: "Photography",
            tasks: ["Confirm the photographer", "Share the function schedule"],
          },
          {
            name: "Decoration",
            tasks: [
              "Discuss flowers and mandap setup",
              "Confirm setup completion time",
            ],
          },
          {
            name: "Lighting",
            tasks: [
              "Confirm lighting and power arrangements",
              "Check the setup before the ceremony",
            ],
          },
        ];
        const missing = templates.filter(
          (item) =>
            !planning.departments.some(
              (existing) =>
                existing.name.toLowerCase() === item.name.toLowerCase(),
            ),
        );
        if (planning.departments.length + missing.length > 40)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "Not enough room for the starter departments.",
          );
        for (const item of missing)
          planning.departments.push({
            name: item.name,
            checklist: item.tasks.map((title) => ({ title })),
            updates: [
              { actor, at: now, message: "Added from the wedding checklist" },
            ],
          });
        break;
      }
      case "updateSettings":
        planning.staleAfterDays = command.staleAfterDays;
        break;
      case "updateWork":
        if (command.onBehalf && !organizer)
          throw httpError(
            403,
            "FORBIDDEN",
            "Only organizers can record an update on behalf of a vendor.",
          );
        if (department!.status === command.status && !command.note)
          throw httpError(
            422,
            "INVALID_INPUT",
            "Change the status or add a progress note.",
          );
        department!.status = command.status;
        department!.lastProgressAt = now;
        department!.updates.push({
          actor,
          at: now,
          onBehalf: command.onBehalf,
          message: command.note || "Status changed to " + command.status,
        });
        break;
      case "addChecklistItem":
        if (department!.checklist.length >= 100)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "A department can have up to 100 checklist items.",
          );
        department!.checklist.push({ title: command.title });
        department!.updates.push({
          actor,
          at: now,
          message: "Checklist item added: " + command.title,
        });
        break;
      case "updateChecklistItem": {
        const item = department!.checklist.id(command.itemId);
        if (!item)
          throw httpError(404, "NOT_FOUND", "Checklist item not found.");
        if (item.status === command.status)
          throw httpError(
            422,
            "INVALID_INPUT",
            "Choose a different work status.",
          );
        item.status = command.status;
        department!.lastProgressAt = now;
        department!.updates.push({
          actor,
          at: now,
          message: item.title + " — " + command.status,
        });
        break;
      }
      case "removeChecklistItem": {
        const item = department!.checklist.id(command.itemId);
        if (!item)
          throw httpError(404, "NOT_FOUND", "Checklist item not found.");
        department!.updates.push({
          actor,
          at: now,
          message: "Checklist item removed: " + item.title,
        });
        item.deleteOne();
        break;
      }
      case "raiseAttention":
        department!.set("flag", {
          reason: command.reason,
          raisedBy: actor,
          raisedAt: now,
          resolvedBy: "",
          resolvedAt: null,
        });
        department!.updates.push({
          actor,
          at: now,
          message: "Attention requested: " + command.reason,
        });
        break;
      case "resolveAttention":
        if (!department!.flag?.reason || department!.flag.resolvedAt)
          throw httpError(
            409,
            "FLAG_RESOLVED",
            "There is no open flag to resolve.",
          );
        department!.flag.resolvedBy = actor;
        department!.flag.resolvedAt = now;
        department!.updates.push({
          actor,
          at: now,
          message: "Attention request resolved",
        });
        break;
    }
    if (hasScheduleConflict(wedding, planning.functions))
      throw httpError(
        422,
        "FUNCTION_OVERLAP",
        "This timing overlaps another function or the main wedding. Choose a different time.",
      );
    for (const item of planning.departments) {
      if (item.updates.length > 30)
        item.updates.splice(0, item.updates.length - 30);
    }
    planning.version = command.version + 1;
    const versionFilter =
      command.version === 0
        ? {
            $or: [
              { "planning.version": 0 },
              { "planning.version": { $exists: false } },
            ],
          }
        : { "planning.version": command.version };
    const updated = await Wedding.findOneAndUpdate(
      {
        _id: wedding._id,
        __v: wedding.__v,
        ...versionFilter,
        members: {
          $elemMatch: {
            userId,
            role: wedding.members.find(
              (member) => member.userId.toString() === userId,
            )!.role,
          },
        },
      },
      { $set: { planning: wedding.toObject().planning } },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated)
      throw httpError(
        409,
        "PLANNING_CONFLICT",
        "The plan or your access changed. Reload before saving.",
      );
    res.json({ data: planningData(updated, userId) });
  });
  return router;
}
