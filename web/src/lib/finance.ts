import { api, getCsrfHeaders } from "./api";

type PaymentReceipt = {
  expenseId: string;
  paymentId: string;
  amountPaise: number;
  paidOn: string;
  note: string;
  recordedAt: string;
  recordedBy: string;
  version: number;
};
export type ExpensePayment = PaymentReceipt & {
  voidedAt: string | null;
  voidedBy: string;
  voidReason: string;
};
type ExpenseInput = {
  title: string;
  departmentId: string | null;
  agreedPaise: number;
  notes: string;
};
export type Expense = ExpenseInput & {
  id: string;
  paidPaise: number;
  pendingPaise: number;
  creditPaise: number;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidedBy: string;
  voidReason: string;
  payments: ExpensePayment[];
};
type FinanceSnapshot = {
  title?: string;
  departmentId?: string | null;
  agreedPaise?: number;
  notes?: string;
  budgetPaise?: number | null;
};
export type FinanceSummary = {
  version: number;
  currency: "INR";
  budgetPaise: number | null;
  totals: {
    agreedPaise: number;
    paidPaise: number;
    pendingPaise: number;
    creditPaise: number;
    budgetRemainingPaise: number | null;
  };
};
export type Finance = FinanceSummary & {
  departments: { id: string; name: string }[];
  expenses: Expense[];
  audit: {
    id: string;
    action: string;
    expenseId: string | null;
    actor: string;
    at: string;
    before: FinanceSnapshot | null;
    after: FinanceSnapshot | null;
    reason: string;
  }[];
};
export type FinanceChange =
  | { action: "setBudget"; budgetPaise: number | null }
  | { action: "addExpense"; values: ExpenseInput }
  | { action: "editExpense"; expenseId: string; values: ExpenseInput }
  | { action: "voidExpense"; expenseId: string; reason: string }
  | {
      action: "recordPayment";
      expenseId: string;
      idempotencyKey: string;
      amountPaise: number;
      paidOn: string;
      note: string;
    }
  | {
      action: "voidPayment";
      expenseId: string;
      paymentId: string;
      reason: string;
    };
export type FinanceResult = {
  data: Finance;
  receipt?: PaymentReceipt;
  replayed?: boolean;
};
export async function getFinance(signal?: AbortSignal) {
  const response = await api.get<{ data: Finance }>(
    "/weddings/current/budget",
    { signal },
  );
  return response.data.data;
}
export async function getFinanceSummary(signal?: AbortSignal) {
  const response = await api.get<{
    data: FinanceSummary;
  }>("/weddings/current/budget/summary", { signal });
  return response.data.data;
}
export async function changeFinance(change: FinanceChange, version: number) {
  const response = await api.patch<FinanceResult>(
    "/weddings/current/budget",
    { ...change, version },
    { headers: await getCsrfHeaders() },
  );
  return response.data;
}
export function inr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
export function rupeesToPaise(value: string) {
  const rupees = Number(value);
  const paise = Math.round(rupees * 100);
  if (
    !value.trim() ||
    !Number.isFinite(rupees) ||
    rupees < 0 ||
    !Number.isSafeInteger(paise) ||
    paise > 100_000_000_000 ||
    Math.abs(rupees * 100 - paise) > 0.00001
  )
    throw new Error("Enter a valid INR amount with up to two decimal places.");
  return paise;
}
