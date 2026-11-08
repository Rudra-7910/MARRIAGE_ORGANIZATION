import { Router } from "express";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { z } from "zod";
import { checkCsrf, createSessionMiddleware } from "../auth/auth.session.js";
import { requireUser } from "../../middleware/wedding-access.js";
import { Wedding, canOrganize, roleFor } from "../weddings/wedding.models.js";
import { httpError } from "../../middleware/error-handler.js";
import { maxMoneyPaise } from "./finance.schema.js";

type WeddingDocument = InstanceType<typeof Wedding>;
type Finance = NonNullable<WeddingDocument["finance"]>;
type Expense = Finance["expenses"][number];
type Payment = Expense["payments"][number];
const id = z
  .string()
  .refine(mongoose.isObjectIdOrHexString, "Invalid record ID.");
const money = z.number().int().min(0).max(maxMoneyPaise);
const expenseInput = z
  .object({
    title: z.string().trim().min(2).max(120),
    departmentId: id.nullable(),
    agreedPaise: money,
    notes: z.string().trim().max(1000),
  })
  .strict();
const base = z.object({ version: z.number().int().min(0) });
const commandInput = z.discriminatedUnion("action", [
  base
    .extend({ action: z.literal("setBudget"), budgetPaise: money.nullable() })
    .strict(),
  base
    .extend({ action: z.literal("addExpense"), values: expenseInput })
    .strict(),
  base
    .extend({
      action: z.literal("editExpense"),
      expenseId: id,
      values: expenseInput,
    })
    .strict(),
  base
    .extend({
      action: z.literal("voidExpense"),
      expenseId: id,
      reason: z.string().trim().min(3).max(200),
    })
    .strict(),
  base
    .extend({
      action: z.literal("recordPayment"),
      expenseId: id,
      idempotencyKey: z.uuid(),
      amountPaise: money.min(1),
      paidOn: z.iso.date(),
      note: z.string().trim().max(200),
    })
    .strict(),
  base
    .extend({
      action: z.literal("voidPayment"),
      expenseId: id,
      paymentId: id,
      reason: z.string().trim().min(3).max(200),
    })
    .strict(),
]);
type Command = z.infer<typeof commandInput>;

function paymentReceipt(expenseId: string, payment: Payment) {
  // Immutable result of the original recording, even if that entry is later voided.
  return {
    expenseId,
    paymentId: payment._id.toString(),
    amountPaise: payment.amountPaise,
    paidOn: payment.paidOn,
    note: payment.note,
    recordedAt: payment.recordedAt.toISOString(),
    recordedBy: payment.recordedBy!.name,
    version: payment.recordedVersion,
  };
}
function financeData(wedding: WeddingDocument) {
  const finance = wedding.finance!;
  const departments = wedding.planning!.departments.map((item) => ({
    id: item._id.toString(),
    name: item.name,
  }));
  const expenses = finance.expenses.map((expense) => {
    const paidPaise = expense.payments
      .filter((payment) => !payment.voidedAt)
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    return {
      id: expense._id.toString(),
      title: expense.title,
      departmentId: expense.departmentId?.toString() || null,
      agreedPaise: expense.agreedPaise,
      notes: expense.notes,
      paidPaise,
      pendingPaise: expense.voidedAt
        ? 0
        : Math.max(0, expense.agreedPaise - paidPaise),
      creditPaise: Math.max(0, paidPaise - expense.agreedPaise),
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      voidedAt: expense.voidedAt?.toISOString() || null,
      voidedBy: expense.voidedBy,
      voidReason: expense.voidReason,
      payments: expense.payments
        .map((payment) => ({
          ...paymentReceipt(expense._id.toString(), payment),
          voidedAt: payment.voidedAt?.toISOString() || null,
          voidedBy: payment.voidedBy,
          voidReason: payment.voidReason,
        }))
        .reverse(),
    };
  });
  return {
    ...financeSummary(wedding),
    departments,
    expenses,
    audit: finance.audit
      .map((event) => ({
        id: event._id.toString(),
        action: event.action,
        expenseId: event.expenseId?.toString() || null,
        actor: event.actor!.name,
        at: event.at.toISOString(),
        before: event.toObject().before || null,
        after: event.toObject().after || null,
        reason: event.reason,
      }))
      .reverse(),
  };
}
// Both the overview and detailed ledger use these exact accounting rules.
function financeSummary(wedding: WeddingDocument) {
  const finance = wedding.finance!;
  let agreedPaise = 0,
    paidPaise = 0,
    pendingPaise = 0,
    creditPaise = 0;
  for (const expense of finance.expenses) {
    const paid = expense.payments
      .filter((payment) => !payment.voidedAt)
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    paidPaise += paid;
    if (expense.voidedAt) continue;
    agreedPaise += expense.agreedPaise;
    pendingPaise += Math.max(0, expense.agreedPaise - paid);
    creditPaise += Math.max(0, paid - expense.agreedPaise);
  }
  return {
    version: finance.version,
    currency: "INR" as const,
    budgetPaise: finance.budgetPaise ?? null,
    totals: {
      agreedPaise,
      paidPaise,
      pendingPaise,
      creditPaise,
      budgetRemainingPaise:
        finance.budgetPaise == null ? null : finance.budgetPaise - agreedPaise,
    },
  };
}
function expenseSnapshot(expense: Expense) {
  return {
    title: expense.title,
    departmentId: expense.departmentId?.toString() || null,
    agreedPaise: expense.agreedPaise,
    notes: expense.notes,
  };
}

export function createFinanceRouter() {
  const router = Router();
  router.use(createSessionMiddleware(), requireUser);
  router.use(async (req, res, next) => {
    const wedding = await Wedding.findOne({
      "members.userId": req.session.userId,
    }).select(
      req.path === "/summary"
        ? "createdBy members finance.version finance.budgetPaise finance.expenses.agreedPaise finance.expenses.voidedAt finance.expenses.payments.amountPaise finance.expenses.payments.voidedAt"
        : "+finance",
    );
    if (!wedding)
      throw httpError(
        409,
        "WEDDING_REQUIRED",
        "Create or join a wedding first.",
      );
    if (!canOrganize(roleFor(wedding, req.session.userId!)))
      throw httpError(
        403,
        "FORBIDDEN",
        "Only this wedding’s organizers can view or change expenses.",
      );
    res.locals.wedding = wedding;
    next();
  });
  router.get("/", (_req, res) =>
    res.json({ data: financeData(res.locals.wedding) }),
  );
  router.get("/summary", (_req, res) =>
    res.json({ data: financeSummary(res.locals.wedding) }),
  );
  router.patch("/", checkCsrf, async (req, res) => {
    const command = commandInput.parse(req.body);
    const wedding = res.locals.wedding as WeddingDocument;
    const finance = wedding.finance!;
    const userId = req.session.userId!;
    const actor = { userId, name: res.locals.user.name as string };
    const now = new Date();
    const expense =
      "expenseId" in command ? finance.expenses.id(command.expenseId) : null;
    let requestHash = "";
    if (command.action === "recordPayment") {
      requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            expenseId: command.expenseId,
            amountPaise: command.amountPaise,
            paidOn: command.paidOn,
            note: command.note,
          }),
        )
        .digest("hex");
      const existing = findRecordedPayment(wedding, command, requestHash);
      if (existing) {
        res.json({
          data: financeData(wedding),
          receipt: existing,
          replayed: true,
        });
        return;
      }
    }
    if (finance.version !== command.version)
      throw httpError(
        409,
        "FINANCE_CONFLICT",
        "Expenses changed. Reload the latest amounts before saving.",
      );
    if ("expenseId" in command && !expense)
      throw httpError(404, "NOT_FOUND", "Expense not found in this wedding.");
    if (expense?.voidedAt)
      throw httpError(
        409,
        "EXPENSE_VOIDED",
        "This expense was voided. Its history is read-only.",
      );
    if (command.action === "addExpense" || command.action === "editExpense") {
      if (
        command.values.departmentId &&
        !wedding.planning!.departments.id(command.values.departmentId)
      )
        throw httpError(
          422,
          "INVALID_DEPARTMENT",
          "Choose a department from this wedding, or leave it unlinked.",
        );
    }
    // Payment entries are their own immutable audit. Other edits retain before/after snapshots.
    if (
      !["recordPayment", "voidPayment"].includes(command.action) &&
      finance.audit.length >= 1000
    )
      throw httpError(
        409,
        "LIMIT_REACHED",
        "This wedding has reached its finance change-history limit.",
      );
    switch (command.action) {
      case "setBudget":
        finance.audit.push({
          action: "Budget updated",
          actor,
          at: now,
          before: { budgetPaise: finance.budgetPaise },
          after: { budgetPaise: command.budgetPaise },
        });
        finance.budgetPaise = command.budgetPaise;
        break;
      case "addExpense": {
        if (finance.expenses.length >= 200)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "A wedding can have up to 200 expense entries, including voided ones.",
          );
        finance.expenses.push({
          ...command.values,
          createdAt: now,
          updatedAt: now,
        });
        const added = finance.expenses.at(-1)!;
        finance.audit.push({
          action: "Expense added",
          expenseId: added._id,
          actor,
          at: now,
          after: expenseSnapshot(added),
        });
        break;
      }
      case "editExpense": {
        const before = expenseSnapshot(expense!);
        expense!.set({ ...command.values, updatedAt: now });
        finance.audit.push({
          action: "Expense updated",
          expenseId: expense!._id,
          actor,
          at: now,
          before,
          after: expenseSnapshot(expense!),
        });
        break;
      }
      case "voidExpense":
        if (expense!.payments.some((payment) => !payment.voidedAt))
          throw httpError(
            409,
            "PAYMENTS_EXIST",
            "This expense has recorded payments. Keep it in your tracker; only incorrect payment records should be voided.",
          );
        expense!.set({
          voidedAt: now,
          voidedBy: actor.name,
          voidedById: userId,
          voidReason: command.reason,
          updatedAt: now,
        });
        finance.audit.push({
          action: "Expense voided",
          expenseId: expense!._id,
          actor,
          at: now,
          before: expenseSnapshot(expense!),
          reason: command.reason,
        });
        break;
      case "recordPayment":
        if (expense!.payments.length >= 100)
          throw httpError(
            409,
            "LIMIT_REACHED",
            "An expense can have up to 100 payment records, including voided ones.",
          );
        if (
          command.paidOn >
          now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        )
          throw httpError(
            422,
            "FUTURE_PAYMENT",
            "Use today’s date or an earlier date for a payment already made.",
          );
        expense!.payments.push({
          amountPaise: command.amountPaise,
          paidOn: command.paidOn,
          note: command.note,
          recordedBy: actor,
          recordedAt: now,
          recordedVersion: command.version + 1,
          idempotencyKey: command.idempotencyKey,
          requestHash,
        });
        expense!.updatedAt = now;
        break;
      case "voidPayment": {
        const payment = expense!.payments.id(command.paymentId);
        if (!payment)
          throw httpError(
            404,
            "NOT_FOUND",
            "Payment not found in this expense.",
          );
        if (payment.voidedAt)
          throw httpError(
            409,
            "PAYMENT_VOIDED",
            "This payment record is already voided.",
          );
        payment.set({
          voidedAt: now,
          voidedBy: actor.name,
          voidedById: userId,
          voidReason: command.reason,
        });
        expense!.updatedAt = now;
        break;
      }
    }
    finance.version = command.version + 1;
    // Leave room below MongoDB's document limit, including the existing wedding plan.
    if (
      mongoose.mongo.BSON.calculateObjectSize(wedding.toObject()) >
      12 * 1024 * 1024
    )
      throw httpError(
        409,
        "LIMIT_REACHED",
        "This wedding’s finance history is full. No records were changed.",
      );
    const versionFilter =
      command.version === 0
        ? {
            $or: [
              { "finance.version": 0 },
              { "finance.version": { $exists: false } },
            ],
          }
        : { "finance.version": command.version };
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
      { $set: { finance: wedding.toObject().finance } },
      { returnDocument: "after", runValidators: true },
    ).select("+finance");
    if (!updated) {
      // A concurrent retry with the same key succeeds without creating a second payment.
      if (command.action === "recordPayment") {
        const current = await Wedding.findOne({
          _id: wedding._id,
          "members.userId": userId,
        }).select("+finance");
        if (current && canOrganize(roleFor(current, userId))) {
          const existing = findRecordedPayment(current, command, requestHash);
          if (existing) {
            res.json({
              data: financeData(current),
              receipt: existing,
              replayed: true,
            });
            return;
          }
        }
      }
      throw httpError(
        409,
        "FINANCE_CONFLICT",
        "Expenses or your access changed. Reload before saving.",
      );
    }
    const receipt =
      command.action === "recordPayment"
        ? findRecordedPayment(updated, command, requestHash)
        : undefined;
    res.json({
      data: financeData(updated),
      ...(receipt ? { receipt, replayed: false } : {}),
    });
  });
  return router;
}

function findRecordedPayment(
  wedding: WeddingDocument,
  command: Extract<Command, { action: "recordPayment" }>,
  requestHash: string,
) {
  for (const expense of wedding.finance!.expenses) {
    const payment = expense.payments.find(
      (entry) => entry.idempotencyKey === command.idempotencyKey,
    );
    if (!payment) continue;
    if (payment.requestHash !== requestHash)
      throw httpError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This payment request key was already used for different details. Review the original entry first.",
      );
    return paymentReceipt(expense._id.toString(), payment);
  }
  return null;
}
