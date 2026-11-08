import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "private wedding finance: atomic amounts, payment retries and retained history",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("finance_test");
    process.env.SESSION_SECRET = "finance-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    const { default: express } = await import("express");
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createAuthRouter } = await import("../auth/auth.routes.js");
    const { createFinanceRouter } = await import("./finance.routes.js");
    const { createWeddingRouter } =
      await import("../weddings/wedding.routes.js");
    const { errorHandler } = await import("../../middleware/error-handler.js");
    const { Wedding, Family } = await import("../weddings/wedding.models.js");
    await connectDatabase();
    const app = express();
    app.use(express.json());
    app.use("/api/v1/auth", createAuthRouter());
    app.use("/api/v1/weddings/current/budget", createFinanceRouter());
    app.use("/api/v1", createWeddingRouter());
    app.use(errorHandler);
    const server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    const base = "http://127.0.0.1:" + address.port + "/api/v1";
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    });
    type Client = { cookie: string; id?: string };
    const owner: Client = { cookie: "" },
      organizer: Client = { cookie: "" },
      worker: Client = { cookie: "" },
      manager: Client = { cookie: "" },
      outsider: Client = { cookie: "" };
    async function request(
      client: Client,
      path: string,
      method = "GET",
      body?: unknown,
      csrf = true,
    ) {
      const token: string =
        method !== "GET" && csrf
          ? (await request(client, "/auth/csrf")).body.data.token
          : "";
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: client.cookie,
          Origin: process.env.APP_ORIGIN!,
          "Content-Type": "application/json",
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const cookie = response.headers.get("set-cookie");
      if (cookie) client.cookie = cookie.split(";")[0];
      return { status: response.status, body: await response.json() };
    }
    const root = "/weddings/current/budget";
    async function change(client: Client, body: object, version?: number) {
      const current =
        version ?? (await request(client, root)).body.data.version;
      return request(client, root, "PATCH", { ...body, version: current });
    }
    let weddingId = "",
      publicId = "",
      expenseId = "",
      departmentId = "";
    let firstPaymentId = "",
      secondPaymentId = "";
    let receipt: unknown;
    const paymentKey = randomUUID();
    const payment = {
      action: "recordPayment",
      idempotencyKey: paymentKey,
      amountPaise: 2500,
      paidOn: "2026-11-01",
      note: "Advance, cash paid outside the app",
    };
    await t.test(
      "starts empty and denies anonymous, Worker and Manager finance access",
      async () => {
        assert.equal((await request(owner, root)).status, 401);
        for (const [index, client] of [
          owner,
          organizer,
          worker,
          manager,
          outsider,
        ].entries()) {
          const result = await request(client, "/auth/signup", "POST", {
            name: "Finance member " + index,
            email: "finance-" + index + "@example.com",
            password: "Disposable-Finance-2027",
          });
          assert.equal(result.status, 201);
          client.id = result.body.data.id;
        }
        const family = await Family.create({
          owner: owner.id,
          name: "Our family",
          side: "Both",
        });
        const wedding = await Wedding.create({
          family: family._id,
          createdBy: owner.id,
          brideName: "Meera",
          groomName: "Kabir",
          date: "2027-04-18",
          startTime: "19:00",
          venue: "Family Garden",
          address: "Gate 2, Civil Lines",
          city: "Jaipur",
          contactRole: "Family coordinator",
          phone: "+919999000000",
          members: [
            { userId: owner.id, role: "Admin" },
            { userId: organizer.id, role: "Organizer" },
            { userId: worker.id, role: "Worker" },
            { userId: manager.id, role: "Manager" },
          ],
          planning: { departments: [{ name: "Catering" }] },
        });
        weddingId = wedding.id;
        publicId = wedding.publicId;
        departmentId = wedding.planning!.departments[0]._id.toString();
        const initial = await request(owner, root);
        assert.equal(initial.status, 200);
        assert.equal(initial.body.data.budgetPaise, null);
        assert.deepEqual(initial.body.data.expenses, []);
        assert.equal(initial.body.data.totals.agreedPaise, 0);
        assert.equal((await request(worker, root)).status, 403);
        assert.equal((await request(manager, root)).status, 403);
        assert.equal((await request(outsider, root)).status, 409);
        assert.equal(
          (
            await request(worker, root, "PATCH", {
              action: "setBudget",
              budgetPaise: 1,
              version: 0,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              owner,
              root,
              "PATCH",
              { action: "setBudget", budgetPaise: 1, version: 0 },
              false,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "validates paise and department ownership and persists audit snapshots",
      async () => {
        assert.equal(
          (await change(owner, { action: "setBudget", budgetPaise: 500_000 }))
            .status,
          200,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addExpense",
              values: {
                title: "Caterer",
                departmentId: null,
                agreedPaise: 2.25,
                notes: "",
              },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addExpense",
              values: {
                title: "Caterer",
                departmentId: "000000000000000000000001",
                agreedPaise: 10000,
                notes: "",
              },
            })
          ).status,
          422,
        );
        const added = await change(organizer, {
          action: "addExpense",
          values: {
            title: "Family caterer",
            departmentId,
            agreedPaise: 10000,
            notes: "Dinner agreement",
          },
        });
        assert.equal(added.status, 200);
        expenseId = added.body.data.expenses[0].id;
        assert.equal(added.body.data.totals.pendingPaise, 10000);
        assert.equal(added.body.data.audit[0].actor, "Finance member 1");
        assert.equal(added.body.data.audit[0].after.agreedPaise, 10000);
        assert.equal(
          (await change(owner, { ...payment, expenseId, amountPaise: 0 }))
            .status,
          422,
        );
        assert.equal(
          (await change(owner, { ...payment, expenseId, paidOn: "2099-01-01" }))
            .status,
          422,
        );
      },
    );
    await t.test(
      "concurrent organizers cannot overwrite the same finance version",
      async () => {
        const version = (await request(owner, root)).body.data.version;
        const results = await Promise.all([
          change(owner, { action: "setBudget", budgetPaise: 600000 }, version),
          change(
            organizer,
            { action: "setBudget", budgetPaise: 700000 },
            version,
          ),
        ]);
        assert.deepEqual(results.map((item) => item.status).sort(), [200, 409]);
        assert.equal(
          (await request(owner, root)).body.data.version,
          version + 1,
        );
      },
    );
    await t.test(
      "concurrent payment retries commit once and return the same immutable receipt",
      async () => {
        const version = (await request(owner, root)).body.data.version;
        const results = await Promise.all([
          change(owner, { ...payment, expenseId }, version),
          change(owner, { ...payment, expenseId }, version),
        ]);
        assert.deepEqual(
          results.map((item) => item.status),
          [200, 200],
        );
        assert.deepEqual(results[0].body.receipt, results[1].body.receipt);
        receipt = results[0].body.receipt;
        firstPaymentId = results[0].body.receipt.paymentId;
        const current = (await request(owner, root)).body.data;
        assert.equal(current.version, version + 1);
        assert.equal(current.expenses[0].payments.length, 1);
        assert.equal(current.totals.paidPaise, 2500);
        assert.equal(current.totals.pendingPaise, 7500);
        assert.equal(JSON.stringify(current).includes(paymentKey), false);
        assert.equal(JSON.stringify(current).includes("requestHash"), false);
        assert.equal(
          (await change(owner, { ...payment, expenseId, amountPaise: 2600 }))
            .status,
          409,
        );
      },
    );
    await t.test(
      "overpayments show separate credit and a retry returns its original result",
      async () => {
        const result = await change(owner, {
          ...payment,
          expenseId,
          idempotencyKey: randomUUID(),
          amountPaise: 8500,
        });
        assert.equal(result.status, 200);
        secondPaymentId = result.body.receipt.paymentId;
        assert.equal(result.body.data.totals.paidPaise, 11000);
        assert.equal(result.body.data.totals.pendingPaise, 0);
        assert.equal(result.body.data.totals.creditPaise, 1000);
        const retry = await change(owner, { ...payment, expenseId }, 0);
        assert.equal(retry.status, 200);
        assert.equal(retry.body.replayed, true);
        assert.deepEqual(retry.body.receipt, receipt);
        assert.equal(retry.body.data.expenses[0].payments.length, 2);
      },
    );
    await t.test(
      "voiding retains the payment, actor, reason and original retry receipt",
      async () => {
        const result = await change(organizer, {
          action: "voidPayment",
          expenseId,
          paymentId: firstPaymentId,
          reason: "Duplicate manual entry",
        });
        assert.equal(result.status, 200);
        const entry = result.body.data.expenses[0].payments.find(
          (item: { paymentId: string }) => item.paymentId === firstPaymentId,
        );
        assert.ok(entry.voidedAt);
        assert.equal(entry.voidedBy, "Finance member 1");
        assert.equal(entry.voidReason, "Duplicate manual entry");
        assert.equal(result.body.data.expenses[0].payments.length, 2);
        assert.equal(result.body.data.totals.paidPaise, 8500);
        assert.equal(result.body.data.totals.pendingPaise, 1500);
        assert.equal(result.body.data.totals.creditPaise, 0);
        const retry = await change(owner, { ...payment, expenseId }, 0);
        assert.equal(retry.status, 200);
        assert.deepEqual(retry.body.receipt, receipt);
        assert.equal(
          (
            await change(owner, {
              action: "voidPayment",
              expenseId,
              paymentId: firstPaymentId,
              reason: "Change old reason",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await change(owner, {
              action: "voidExpense",
              expenseId,
              reason: "Remove paid service",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "expense edits preserve history; voided entries cannot be edited or paid",
      async () => {
        let result = await change(owner, {
          action: "editExpense",
          expenseId,
          values: {
            title: "Caterer revised",
            departmentId: null,
            agreedPaise: 9000,
            notes: "Revised agreement",
          },
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.data.audit[0].before.title, "Family caterer");
        assert.equal(result.body.data.audit[0].after.agreedPaise, 9000);
        assert.equal(
          (
            await change(owner, {
              action: "voidPayment",
              expenseId,
              paymentId: secondPaymentId,
              reason: "Incorrect amount in tracker",
            })
          ).status,
          200,
        );
        result = await change(owner, {
          action: "voidExpense",
          expenseId,
          reason: "Added the wrong service",
        });
        assert.equal(result.status, 200);
        assert.equal(
          result.body.data.expenses[0].voidReason,
          "Added the wrong service",
        );
        assert.equal(result.body.data.totals.agreedPaise, 0);
        assert.equal(result.body.data.expenses[0].payments.length, 2);
        assert.equal(
          (
            await change(owner, {
              ...payment,
              expenseId,
              idempotencyKey: randomUUID(),
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "organizer removal during a finance save prevents the atomic write",
      async () => {
        const before = (await request(owner, root)).body.data;
        const original = Wedding.findOneAndUpdate.bind(Wedding);
        let revoked = false;
        const replacement = t.mock.method(
          Wedding,
          "findOneAndUpdate",
          (...args: Parameters<typeof Wedding.findOneAndUpdate>) => {
            const query = original(...args);
            query.pre(async () => {
              if (revoked) return;
              revoked = true;
              await Wedding.updateOne(
                { _id: weddingId },
                {
                  $pull: { members: { userId: organizer.id } },
                  $inc: { __v: 1 },
                },
              );
            });
            return query;
          },
        );
        try {
          const result = await change(
            organizer,
            { action: "setBudget", budgetPaise: 12345 },
            before.version,
          );
          assert.equal(result.status, 409);
          assert.equal(revoked, true);
          const after = (await request(owner, root)).body.data;
          assert.equal(after.version, before.version);
          assert.equal(after.budgetPaise, before.budgetPaise);
        } finally {
          replacement.mock.restore();
        }
      },
    );
    await t.test(
      "select:false and public allowlists keep financial records out of other reads",
      async () => {
        const wedding = await Wedding.findById(weddingId);
        assert.equal(wedding?.finance, undefined);
        const workspace = await request(owner, "/dashboard");
        assert.equal(workspace.status, 200);
        assert.equal("finance" in workspace.body.data.wedding, false);
        const guest = await request(
          { cookie: "" },
          "/public/weddings/" + publicId,
        );
        assert.equal(guest.status, 200);
        assert.equal(
          JSON.stringify(guest.body).includes("Revised agreement"),
          false,
        );
        assert.equal("finance" in guest.body.data, false);
        await Wedding.updateOne(
          { _id: weddingId },
          { $pull: { members: { userId: organizer.id } }, $inc: { __v: 1 } },
        );
        assert.equal((await request(organizer, root)).status, 409);
      },
    );
    await t.test(
      "overview totals match the ledger without disclosing the ledger or allowing staff access",
      async () => {
        const ledger = (await request(owner, root)).body.data;
        const result = await request(owner, root + "/summary");
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.data, {
          version: ledger.version,
          currency: "INR",
          budgetPaise: ledger.budgetPaise,
          totals: ledger.totals,
        });
        assert.equal("expenses" in result.body.data, false);
        assert.equal("audit" in result.body.data, false);
        for (const client of [worker, manager])
          assert.equal((await request(client, root + "/summary")).status, 403);
        assert.equal(
          (await request({ cookie: "" }, root + "/summary")).status,
          401,
        );
      },
    );
    await t.test(
      "legacy weddings without finance start at version zero and save atomically",
      async () => {
        await Wedding.collection.updateOne(
          { _id: (await Wedding.findById(weddingId))!._id },
          { $unset: { finance: "" } },
        );
        const current = await request(owner, root);
        assert.equal(current.status, 200);
        assert.equal(current.body.data.version, 0);
        assert.equal(current.body.data.budgetPaise, null);
        const summary = (await request(owner, root + "/summary")).body.data;
        assert.deepEqual(summary.totals, current.body.data.totals);
        const result = await change(
          owner,
          { action: "setBudget", budgetPaise: 10000 },
          0,
        );
        assert.equal(result.status, 200);
        assert.equal(result.body.data.budgetPaise, 10000);
      },
    );
  },
);
