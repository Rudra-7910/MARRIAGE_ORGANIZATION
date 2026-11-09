import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Icon } from "../../components/ui/Icon";
import { apiMessage } from "../../lib/api";
import {
  changeFinance,
  getFinance,
  inr,
  rupeesToPaise,
} from "../../lib/finance";
import type {
  Expense,
  ExpensePayment,
  Finance,
  FinanceChange,
} from "../../lib/finance";
import { PlanningDialog } from "./PlanningDialog";
import { planningTime } from "../../lib/planning";

type Editor =
  | { kind: "budget"; version: number }
  | { kind: "expense"; version: number; expense?: Expense }
  | {
      kind: "payment";
      version: number;
      expense: Expense;
      idempotencyKey: string;
    }
  | { kind: "voidExpense"; version: number; expense: Expense }
  | {
      kind: "voidPayment";
      version: number;
      expense: Expense;
      payment: ExpensePayment;
    };

export function BudgetPage({ userId }: { userId: string }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("Active");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["finance", userId],
    queryFn: ({ signal }) => getFinance(signal),
    refetchInterval: editor ? false : 30000,
    refetchOnWindowFocus: !editor,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: ({
      change,
      version,
    }: {
      change: FinanceChange;
      version: number;
    }) => changeFinance(change, version),
    onSuccess: (result) => {
      cache.setQueryData(["finance", userId], result.data);
      const { version, currency, budgetPaise, totals } = result.data;
      cache.setQueryData(["finance-summary", userId], {
        version,
        currency,
        budgetPaise,
        totals,
      });
      setEditor(null);
      setNotice(
        result.receipt
          ? (result.replayed
              ? "This payment was already recorded. "
              : "Payment recorded. ") +
              inr(result.receipt.amountPaise) +
              " on " +
              result.receipt.paidOn +
              ". No money was transferred."
          : "Expense tracker updated.",
      );
    },
  });
  function openEditor(next: Editor) {
    mutation.reset();
    setNotice("");
    setEditor(next);
  }
  const finance = query.data;
  const selected = finance?.expenses.find((item) => item.id === selectedId);
  const expenses =
    finance?.expenses.filter(
      (item) =>
        (filter === "Voided" ? Boolean(item.voidedAt) : !item.voidedAt) &&
        (item.title + " " + item.notes)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="finance-page">
      <div className="dash-page-heading">
        <div>
          <h1>Budget & expenses</h1>
          <p>Agreed costs, payments already made and what is still due.</p>
        </div>
        <button
          className="ws-button ws-primary"
          disabled={!finance || query.isError}
          onClick={() =>
            openEditor({ kind: "expense", version: finance!.version })
          }
        >
          <Icon name="plus" /> Add expense
        </button>
      </div>
      <p className="finance-privacy">
        <Icon name="lock" /> Only this wedding’s organizers can see these
        amounts. This is a tracker, with no fund transfers.
      </p>
      {notice && (
        <p className="finance-notice" role="status">
          {notice}
        </p>
      )}
      {query.isPending ? (
        <div className="plan-loading" role="status">
          Opening your expense tracker…
        </div>
      ) : query.isError ? (
        <div className="ws-form-error" role="alert">
          <p>{apiMessage(query.error)}</p>
          <button className="ws-button" onClick={() => query.refetch()}>
            Reload expenses
          </button>
        </div>
      ) : (
        finance && (
          <>
            <div className="finance-summary">
              <div>
                <span>Wedding budget</span>
                <strong>
                  {finance.budgetPaise === null
                    ? "Not set"
                    : inr(finance.budgetPaise)}
                </strong>
                <button
                  className="ws-text-link"
                  onClick={() =>
                    openEditor({ kind: "budget", version: finance.version })
                  }
                >
                  {finance.budgetPaise === null ? "Set budget" : "Edit budget"}
                </button>
              </div>
              <div>
                <span>Agreed costs</span>
                <strong>{inr(finance.totals.agreedPaise)}</strong>
                <small>Active service entries</small>
              </div>
              <div>
                <span>Payments recorded</span>
                <strong>{inr(finance.totals.paidPaise)}</strong>
                <small>Excludes voided records</small>
              </div>
              <div>
                <span>Pending dues</span>
                <strong>{inr(finance.totals.pendingPaise)}</strong>
                <small>Amounts still due by service</small>
              </div>
              <div>
                <span>Service credit</span>
                <strong>{inr(finance.totals.creditPaise)}</strong>
                <small>Recorded above agreed costs</small>
              </div>
            </div>
            {finance.totals.budgetRemainingPaise !== null && (
              <p
                className={
                  "finance-budget-note" +
                  (finance.totals.budgetRemainingPaise < 0 ? " is-over" : "")
                }
              >
                {finance.totals.budgetRemainingPaise < 0
                  ? "Agreed costs exceed your budget by " +
                    inr(-finance.totals.budgetRemainingPaise) +
                    "."
                  : inr(finance.totals.budgetRemainingPaise) +
                    " of your budget is not yet committed."}
              </p>
            )}
            <section className="dash-card finance-register">
              <div className="finance-toolbar">
                <div className="dash-tabs" aria-label="Expense records">
                  {["Active", "Voided"].map((value) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      className={filter === value ? "is-active" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <label className="dash-search">
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Search expenses"
                    placeholder="Search service or note"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              {!expenses.length ? (
                <div className="dash-empty-section">
                  <h2>
                    {search
                      ? "No matching expenses"
                      : filter === "Voided"
                        ? "No voided expenses"
                        : "Start with an agreed service cost."}
                  </h2>
                  <p>
                    {search
                      ? "Try another service name or clear your search."
                      : filter === "Voided"
                        ? "Voided entries stay here with their original history and a reason."
                        : "Add catering, photography or another service. Record payments as they happen."}
                  </p>
                  {filter === "Active" && !search && (
                    <button
                      className="ws-button ws-primary"
                      onClick={() =>
                        openEditor({
                          kind: "expense",
                          version: finance.version,
                        })
                      }
                    >
                      Add your first expense
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="dash-table-wrap"
                  tabIndex={0}
                  aria-label="Service expenses, scroll horizontally for all columns"
                >
                  <table className="dash-table finance-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Agreed cost</th>
                        <th>Paid</th>
                        <th>Pending</th>
                        <th>Credit</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.title}</strong>
                            <span className="finance-table-note">
                              {finance.departments.find(
                                (department) =>
                                  department.id === item.departmentId,
                              )?.name ||
                                (item.departmentId
                                  ? "Unlinked department"
                                  : "Separate expense")}
                            </span>
                          </td>
                          <td>{inr(item.agreedPaise)}</td>
                          <td>{inr(item.paidPaise)}</td>
                          <td>{inr(item.pendingPaise)}</td>
                          <td>{inr(item.creditPaise)}</td>
                          <td>
                            <button
                              className="ws-text-link"
                              onClick={() => setSelectedId(item.id)}
                              aria-label={"View " + item.title + " expense"}
                            >
                              View details <Icon name="arrow" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {finance.audit.length > 0 && (
              <details className="finance-history">
                <summary>
                  Expense change history ({finance.audit.length})
                </summary>
                <ol>
                  {finance.audit.map((event) => (
                    <li key={event.id}>
                      <div>
                        <strong>{event.action}</strong>
                        <span>
                          {event.actor}, {planningTime(event.at)}
                        </span>
                      </div>
                      {(event.after?.title || event.before?.title) && (
                        <p>{event.after?.title || event.before?.title}</p>
                      )}
                      {event.action === "Budget updated" ? (
                        <p>
                          {event.before?.budgetPaise == null
                            ? "No budget"
                            : inr(event.before.budgetPaise)}{" "}
                          to{" "}
                          {event.after?.budgetPaise == null
                            ? "No budget"
                            : inr(event.after.budgetPaise)}
                        </p>
                      ) : (
                        <>
                          {event.before?.agreedPaise !== undefined && (
                            <p>
                              Previous agreed cost:{" "}
                              {inr(event.before.agreedPaise)}
                            </p>
                          )}
                          {event.after?.agreedPaise !== undefined && (
                            <p>Agreed cost: {inr(event.after.agreedPaise)}</p>
                          )}
                        </>
                      )}
                      {event.reason && <p>Reason: {event.reason}</p>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <p className="finance-footnote">
              Amounts are in Indian rupees. Voiding corrects a record and keeps
              its history; it does not reverse a real payment.
            </p>
          </>
        )
      )}
      {finance && selected && !editor && (
        <PlanningDialog
          title={selected.title}
          wide
          onClose={() => setSelectedId("")}
        >
          <div className="finance-detail">
            <div className="finance-detail-totals">
              <div>
                <span>Agreed</span>
                <strong>{inr(selected.agreedPaise)}</strong>
              </div>
              <div>
                <span>Paid</span>
                <strong>{inr(selected.paidPaise)}</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{inr(selected.pendingPaise)}</strong>
              </div>
              <div>
                <span>Credit</span>
                <strong>{inr(selected.creditPaise)}</strong>
              </div>
            </div>
            {selected.notes && (
              <p className="finance-notes">{selected.notes}</p>
            )}
            {selected.voidedAt ? (
              <p className="finance-void-note">
                Expense voided by {selected.voidedBy}: {selected.voidReason}
              </p>
            ) : (
              <div className="finance-actions">
                <button
                  className="ws-button ws-primary"
                  onClick={() =>
                    openEditor({
                      kind: "payment",
                      version: finance.version,
                      expense: selected,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  }
                >
                  Record payment
                </button>
                <button
                  className="ws-button"
                  onClick={() =>
                    openEditor({
                      kind: "expense",
                      version: finance.version,
                      expense: selected,
                    })
                  }
                >
                  Edit expense
                </button>
                <button
                  className="ws-text-link"
                  disabled={selected.payments.some(
                    (payment) => !payment.voidedAt,
                  )}
                  onClick={() =>
                    openEditor({
                      kind: "voidExpense",
                      version: finance.version,
                      expense: selected,
                    })
                  }
                >
                  Void expense
                </button>
              </div>
            )}
            {!selected.voidedAt &&
              selected.payments.some((payment) => !payment.voidedAt) && (
                <p className="ws-help">
                  Expenses with recorded payments remain in your tracker. Void
                  only incorrect payment records.
                </p>
              )}
            <h3 className="finance-payment-heading">Payment history</h3>
            {!selected.payments.length ? (
              <p className="ws-help">No payments recorded for this service.</p>
            ) : (
              <ol className="finance-payments">
                {selected.payments.map((payment) => (
                  <li key={payment.paymentId}>
                    <div>
                      <strong>{inr(payment.amountPaise)}</strong>
                      <time dateTime={payment.paidOn}>{payment.paidOn}</time>
                    </div>
                    <p>
                      Recorded by {payment.recordedBy},{" "}
                      {planningTime(payment.recordedAt)}
                    </p>
                    {payment.note && <p>{payment.note}</p>}
                    {payment.voidedAt ? (
                      <p className="finance-void-note">
                        Voided by {payment.voidedBy}: {payment.voidReason}
                      </p>
                    ) : (
                      <button
                        className="ws-text-link"
                        onClick={() =>
                          openEditor({
                            kind: "voidPayment",
                            version: finance.version,
                            expense: selected,
                            payment,
                          })
                        }
                      >
                        Void incorrect record
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </PlanningDialog>
      )}
      {finance && editor && (
        <FinanceEditor
          key={
            editor.kind +
            ("expense" in editor ? editor.expense?.id || "new" : "")
          }
          editor={editor}
          finance={finance}
          saving={mutation.isPending}
          error={mutation.isError ? apiMessage(mutation.error) : ""}
          canCorrect={
            axios.isAxiosError(mutation.error) &&
            mutation.error.response?.status === 422
          }
          onSave={(change) =>
            mutation.mutate({ change, version: editor.version })
          }
          onClose={() => {
            if (!mutation.isPending) setEditor(null);
          }}
          onReload={() => {
            setEditor(null);
            mutation.reset();
            void query.refetch();
          }}
        />
      )}
    </div>
  );
}

type EditorValues = {
  budget: string;
  title: string;
  departmentId: string;
  agreed: string;
  notes: string;
  amount: string;
  paidOn: string;
  note: string;
  reason: string;
};
function FinanceEditor({
  editor,
  finance,
  saving,
  error,
  canCorrect,
  onSave,
  onClose,
  onReload,
}: {
  editor: Editor;
  finance: Finance;
  saving: boolean;
  error: string;
  canCorrect: boolean;
  onSave: (change: FinanceChange) => void;
  onClose: () => void;
  onReload: () => void;
}) {
  const expense = "expense" in editor ? editor.expense : undefined;
  const [submittedPayment, setSubmittedPayment] =
    useState<FinanceChange | null>(null);
  const [inputError, setInputError] = useState("");
  const { register, handleSubmit } = useForm<EditorValues>({
    defaultValues: {
      budget:
        finance.budgetPaise === null ? "" : String(finance.budgetPaise / 100),
      title: expense?.title || "",
      departmentId: finance.departments.some(
        (item) => item.id === expense?.departmentId,
      )
        ? expense!.departmentId!
        : "",
      agreed: String((expense?.agreedPaise || 0) / 100),
      notes: expense?.notes || "",
      amount: "",
      paidOn: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      }),
      note: "",
      reason: "",
    },
  });
  let title = "Void expense";
  if (editor.kind === "budget") title = "Wedding budget";
  else if (editor.kind === "expense")
    title = expense ? "Edit expense" : "Add expense";
  else if (editor.kind === "payment") title = "Record a payment already made";
  else if (editor.kind === "voidPayment")
    title = "Void an incorrect payment record";
  const frozenPayment = canCorrect ? null : submittedPayment;
  return (
    <PlanningDialog title={title} onClose={onClose}>
      <form
        className="plan-form finance-form"
        onSubmit={handleSubmit((values) => {
          setInputError("");
          try {
            let command: FinanceChange;
            if (editor.kind === "budget")
              command = {
                action: "setBudget",
                budgetPaise: values.budget.trim()
                  ? rupeesToPaise(values.budget)
                  : null,
              };
            else if (editor.kind === "expense") {
              const entry = {
                title: values.title,
                departmentId: values.departmentId || null,
                agreedPaise: rupeesToPaise(values.agreed),
                notes: values.notes,
              };
              command = editor.expense
                ? {
                    action: "editExpense",
                    expenseId: editor.expense.id,
                    values: entry,
                  }
                : { action: "addExpense", values: entry };
            } else if (editor.kind === "payment") {
              command = frozenPayment || {
                action: "recordPayment",
                expenseId: editor.expense.id,
                idempotencyKey: editor.idempotencyKey,
                amountPaise: rupeesToPaise(values.amount),
                paidOn: values.paidOn,
                note: values.note,
              };
              setSubmittedPayment(command);
            } else if (editor.kind === "voidPayment")
              command = {
                action: "voidPayment",
                expenseId: editor.expense.id,
                paymentId: editor.payment.paymentId,
                reason: values.reason,
              };
            else
              command = {
                action: "voidExpense",
                expenseId: editor.expense.id,
                reason: values.reason,
              };
            onSave(command);
          } catch (caught) {
            setInputError(apiMessage(caught));
          }
        })}
      >
        <fieldset disabled={saving || Boolean(frozenPayment)}>
          {editor.kind === "budget" && (
            <>
              <p className="ws-help">
                Optional overall budget. Leave blank to remove it; existing
                expenses and payment history stay saved.
              </p>
              <label>
                Wedding budget (₹)
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  {...register("budget")}
                />
              </label>
            </>
          )}
          {editor.kind === "expense" && (
            <>
              <label>
                Service or expense name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Catering"
                  {...register("title")}
                />
              </label>
              <label>
                Linked department (optional)
                <select {...register("departmentId")}>
                  <option value="">Separate expense</option>
                  {finance.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Agreed cost (₹)
                <input
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  {...register("agreed")}
                />
              </label>
              <label>
                Notes (optional)
                <textarea maxLength={1000} {...register("notes")} />
              </label>
            </>
          )}
          {editor.kind === "payment" && (
            <>
              <p className="ws-help">
                For {editor.expense.title}. Record a payment you made outside
                this app; this action does not send money.
              </p>
              <label>
                Amount paid (₹)
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  {...register("amount")}
                />
              </label>
              <label>
                Payment date
                <input
                  required
                  type="date"
                  max={new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Kolkata",
                  })}
                  {...register("paidOn")}
                />
              </label>
              <label>
                Reference or note (optional)
                <textarea maxLength={200} {...register("note")} />
              </label>
            </>
          )}
          {(editor.kind === "voidPayment" || editor.kind === "voidExpense") && (
            <>
              <p className="finance-void-note">
                {editor.kind === "voidPayment"
                  ? inr(editor.payment.amountPaise) +
                    " for " +
                    editor.expense.title
                  : editor.expense.title}{" "}
                stays in your history with this reason. This does not reverse
                any money.
              </p>
              <label>
                Reason for voiding
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  {...register("reason")}
                />
              </label>
            </>
          )}
        </fieldset>
        {(error || inputError) && (
          <div className="ws-form-error" role="alert">
            <p>{inputError || error}</p>
            {error && (
              <button className="ws-text-link" type="button" onClick={onReload}>
                Discard draft & reload
              </button>
            )}
          </div>
        )}
        {frozenPayment && error && (
          <p className="ws-help">
            Retry keeps the same payment details and request key. Review the
            payment history before starting another record.
          </p>
        )}
        <div className="finance-form-actions">
          <button
            type="button"
            className="ws-button"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="ws-button ws-primary" disabled={saving}>
            {saving
              ? "Saving…"
              : editor.kind === "payment"
                ? frozenPayment
                  ? "Retry same payment record"
                  : "Record payment"
                : editor.kind === "voidPayment" || editor.kind === "voidExpense"
                  ? "Confirm void"
                  : "Save changes"}
          </button>
        </div>
      </form>
    </PlanningDialog>
  );
}
