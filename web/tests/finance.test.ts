import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "../src/lib/api";
import {
  changeFinance,
  getFinance,
  inr,
  rupeesToPaise,
} from "../src/lib/finance";
import type { Finance } from "../src/lib/finance";
import { BudgetPage } from "../src/features/weddings/BudgetPage";

test("finance client sends integer paise, captured versions, CSRF and the same payment request key", async (t) => {
  const requests: {
    method: string;
    url: string;
    csrf?: string;
    body: unknown;
  }[] = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    requests.push({
      method: req.method!,
      url: req.url!,
      csrf: req.headers["x-csrf-token"] as string | undefined,
      body: raw ? JSON.parse(raw) : null,
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        data: req.url?.endsWith("/csrf")
          ? { token: "finance-csrf" }
          : { version: 9, expenses: [] },
        receipt: { paymentId: "original-payment" },
        replayed: false,
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  const previous = api.defaults.baseURL;
  api.defaults.baseURL = "http://127.0.0.1:" + address.port + "/api/v1";
  t.after(async () => {
    api.defaults.baseURL = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await getFinance();
  assert.equal(requests.at(-1)!.url, "/api/v1/weddings/current/budget");
  const payment = {
    action: "recordPayment" as const,
    expenseId: "service",
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    amountPaise: 29,
    paidOn: "2026-11-01",
    note: "Cash advance",
  };
  const result = await changeFinance(payment, 8);
  assert.equal(requests.at(-1)!.method, "PATCH");
  assert.equal(requests.at(-1)!.csrf, "finance-csrf");
  assert.deepEqual(requests.at(-1)!.body, { ...payment, version: 8 });
  assert.equal(result.receipt!.paymentId, "original-payment");
  await changeFinance(payment, 8);
  assert.deepEqual(requests.at(-1)!.body, { ...payment, version: 8 });
});

test("INR entry converts decimal rupees once and rejects fractional paise or unsafe values", () => {
  assert.equal(rupeesToPaise("0.29"), 29);
  assert.equal(rupeesToPaise("1250.50"), 125050);
  assert.equal(rupeesToPaise("0"), 0);
  for (const value of ["", "-1", "0.001", "NaN", "Infinity", "1000000001"])
    assert.throws(() => rupeesToPaise(value));
  assert.equal(inr(123456789), "₹12,34,567.89");
});

const empty: Finance = {
  version: 0,
  currency: "INR",
  budgetPaise: null,
  totals: {
    agreedPaise: 0,
    paidPaise: 0,
    pendingPaise: 0,
    creditPaise: 0,
    budgetRemainingPaise: null,
  },
  departments: [],
  expenses: [],
  audit: [],
};
function render(finance: Finance) {
  const client = new QueryClient();
  client.setQueryData(["finance", "organizer"], finance);
  return renderToStaticMarkup(
    h(QueryClientProvider, { client }, h(BudgetPage, { userId: "organizer" })),
  );
}

test("a new wedding gets an empty tracker and optional budget, without fabricated expenses", () => {
  const html = render(empty);
  assert.match(html, /Set budget/);
  assert.match(html, /Start with an agreed service cost/);
  assert.match(html, /no fund transfers/);
  assert.doesNotMatch(
    html,
    /Family caterer|Caterer deposit|Photography advance/,
  );
});

test("the expense register displays fetched pending dues and a separate overpayment credit", () => {
  const html = render({
    ...empty,
    budgetPaise: 500000,
    totals: {
      agreedPaise: 10000,
      paidPaise: 12500,
      pendingPaise: 0,
      creditPaise: 2500,
      budgetRemainingPaise: 490000,
    },
    expenses: [
      {
        id: "caterer",
        title: "Our saved caterer",
        departmentId: null,
        agreedPaise: 10000,
        notes: "",
        paidPaise: 12500,
        pendingPaise: 0,
        creditPaise: 2500,
        createdAt: "2026-11-01T12:00:00Z",
        updatedAt: "2026-11-01T12:00:00Z",
        voidedAt: null,
        voidedBy: "",
        voidReason: "",
        payments: [],
      },
    ],
  });
  assert.match(html, /Our saved caterer/);
  assert.match(html, /Service credit/);
  assert.match(html, /₹25/);
  assert.doesNotMatch(html, /₹-25/);
  assert.match(html, /scroll horizontally for all columns/);
});
