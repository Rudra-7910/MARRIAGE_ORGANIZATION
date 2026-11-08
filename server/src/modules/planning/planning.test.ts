import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "real wedding planning: scoped work, schedule conflicts and atomic saves",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("planning_test");
    process.env.SESSION_SECRET = "planning-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    const { Wedding, Family } = await import("../weddings/wedding.models.js");
    await connectDatabase();
    const server = createServer(createApp());
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = server.address();
    if (!port || typeof port === "string") throw new Error("Missing test port");
    const base = "http://127.0.0.1:" + port.port + "/api/v1";
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
    const root = "/weddings/current/planning";
    async function change(client: Client, command: object, version?: number) {
      const current =
        version ?? (await request(client, root)).body.data.version;
      return request(client, root, "PATCH", { ...command, version: current });
    }
    const weddingValues = {
      brideName: "Planning Bride",
      groomName: "Planning Groom",
      date: "2027-04-18",
      startTime: "20:00",
      endTime: "01:00",
      venue: "Family Garden",
      address: "Gate 2, Civil Lines",
      city: "Jaipur",
      latitude: null,
      longitude: null,
      contactRole: "Family coordinator",
      phone: "+919999000000",
      welcome: "",
      youtube: "",
    };
    let weddingId = "",
      publicId = "",
      departmentId = "",
      taskId = "";
    await t.test(
      "fresh weddings have no fake work and anonymous access is rejected",
      async () => {
        assert.equal((await request(owner, root)).status, 401);
        for (const [index, client] of [
          owner,
          organizer,
          worker,
          manager,
          outsider,
        ].entries()) {
          const created = await request(client, "/auth/signup", "POST", {
            name: "Planning member " + index,
            email: "plan-" + index + "@example.com",
            password: "Disposable-Planning-2027",
          });
          assert.equal(created.status, 201);
          client.id = created.body.data.id;
        }
        const family = await Family.create({
          owner: owner.id,
          name: "Our family",
          side: "Both",
        });
        const wedding = await Wedding.create({
          ...weddingValues,
          family: family._id,
          createdBy: owner.id,
          members: [
            { userId: owner.id, role: "Admin" },
            { userId: organizer.id, role: "Organizer" },
            { userId: worker.id, role: "Worker" },
            { userId: manager.id, role: "Manager" },
          ],
        });
        weddingId = wedding.id;
        publicId = wedding.publicId;
        const otherFamily = await Family.create({
          owner: outsider.id,
          name: "Other family",
          side: "Both",
        });
        await Wedding.create({
          ...weddingValues,
          family: otherFamily._id,
          createdBy: outsider.id,
          members: [{ userId: outsider.id, role: "Admin" }],
        });
        const initial = await request(owner, root);
        assert.equal(initial.status, 200);
        assert.equal(initial.body.data.version, 0);
        assert.deepEqual(initial.body.data.functions, []);
        assert.deepEqual(initial.body.data.departments, []);
        assert.equal((await request(worker, root)).body.data.canManage, false);
      },
    );
    await t.test(
      "starter checklist is optional, editable and does not duplicate departments",
      async () => {
        assert.equal(
          (
            await request(
              owner,
              root,
              "PATCH",
              { action: "applyTemplate", version: 0 },
              false,
            )
          ).status,
          403,
        );
        let result = await change(owner, { action: "applyTemplate" });
        assert.equal(result.status, 200);
        assert.equal(result.body.data.departments.length, 5);
        assert.ok(
          result.body.data.departments.every(
            (item: { status: string; total: number }) =>
              item.status === "To do" && item.total === 2,
          ),
        );
        result = await change(owner, { action: "applyTemplate" });
        assert.equal(result.body.data.departments.length, 5);
        assert.equal(
          (await change(worker, { action: "applyTemplate" })).status,
          403,
        );
      },
    );
    const departmentValues = {
      name: "Family music team",
      kind: "Outside vendor",
      contactRole: "Sound coordinator",
      phone: "9999900000",
      notes: "Private stage instructions",
      deadline: "2027-04-17T18:00",
      memberIds: [] as string[],
    };
    await t.test(
      "organizers assign only wedding members; cross-department notes stay private",
      async () => {
        assert.equal(
          (
            await change(owner, {
              action: "addDepartment",
              values: { ...departmentValues, memberIds: [outsider.id] },
            })
          ).status,
          422,
        );
        const added = await change(owner, {
          action: "addDepartment",
          values: { ...departmentValues, memberIds: [worker.id, manager.id] },
        });
        assert.equal(added.status, 200);
        departmentId = added.body.data.departments.at(-1).id;
        const work = (await request(worker, root)).body.data.departments;
        assert.equal(
          work.find((item: { id: string }) => item.id === departmentId).notes,
          departmentValues.notes,
        );
        assert.equal(work[0].notes, undefined);
        assert.equal(work[0].updates, undefined);
        assert.equal(work[0].memberIds, undefined);
        assert.equal(
          (
            await change(outsider, {
              action: "updateWork",
              id: departmentId,
              status: "Done",
              note: "",
              onBehalf: false,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await change(worker, {
              action: "editDepartment",
              id: departmentId,
              values: { ...departmentValues, memberIds: [] },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await change(worker, {
              action: "updateWork",
              id: departmentId,
              status: "Done",
              note: "",
              onBehalf: true,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await change(worker, {
              action: "updateWork",
              id: work[0].id,
              status: "Done",
              note: "",
              onBehalf: false,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "assigned staff update a shared checklist without an individual task owner",
      async () => {
        const added = await change(worker, {
          action: "addChecklistItem",
          id: departmentId,
          title: "Check microphone levels",
        });
        assert.equal(added.status, 200);
        taskId = added.body.data.departments.find(
          (item: { id: string }) => item.id === departmentId,
        ).checklist[0].id;
        const done = await change(manager, {
          action: "updateChecklistItem",
          id: departmentId,
          itemId: taskId,
          status: "Done",
        });
        assert.equal(done.status, 200);
        assert.equal(
          done.body.data.departments.find(
            (item: { id: string }) => item.id === departmentId,
          ).completed,
          1,
        );
        assert.equal(
          (
            await change(worker, {
              action: "removeChecklistItem",
              id: departmentId,
              itemId: taskId,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "attention groups manual, stale and overdue reasons; contact edits do not fake progress",
      async () => {
        const old = new Date(Date.now() - 8 * 86400000);
        await Wedding.updateOne(
          { _id: weddingId, "planning.departments._id": departmentId },
          {
            $set: {
              "planning.departments.$.lastProgressAt": old,
              "planning.departments.$.deadline": "2020-01-01T12:00",
            },
          },
        );
        let result = await change(owner, {
          action: "editDepartment",
          id: departmentId,
          values: {
            ...departmentValues,
            deadline: "2020-01-01T12:00",
            memberIds: [worker.id, manager.id],
          },
        });
        let item = result.body.data.departments.find(
          (value: { id: string }) => value.id === departmentId,
        );
        assert.equal(item.lastProgressAt, old.toISOString());
        assert.equal(item.attentionReasons.length, 2);
        result = await change(worker, {
          action: "raiseAttention",
          id: departmentId,
          reason: "Please confirm the stage layout",
        });
        item = result.body.data.departments.find(
          (value: { id: string }) => value.id === departmentId,
        );
        assert.equal(item.attentionReasons.length, 3);
        assert.equal(item.lastProgressAt, old.toISOString());
        const publicSummary = (await request(worker, root)).body.data
          .departments[0];
        assert.equal(publicSummary.notes, undefined);
        assert.equal(
          (
            await change(manager, {
              action: "resolveAttention",
              id: departmentId,
            })
          ).status,
          403,
        );
        result = await change(owner, {
          action: "updateWork",
          id: departmentId,
          status: "Done",
          note: "Vendor confirmed everything by phone",
          onBehalf: true,
        });
        item = result.body.data.departments.find(
          (value: { id: string }) => value.id === departmentId,
        );
        assert.deepEqual(item.attentionReasons, [
          "Please confirm the stage layout",
        ]);
        assert.equal(item.updates[0].onBehalf, true);
        result = await change(owner, {
          action: "resolveAttention",
          id: departmentId,
        });
        assert.deepEqual(
          result.body.data.departments.find(
            (value: { id: string }) => value.id === departmentId,
          ).attentionReasons,
          [],
        );
        result = await change(worker, {
          action: "updateWork",
          id: departmentId,
          status: "In progress",
          note: "Rechecking sound",
          onBehalf: false,
        });
        assert.equal(result.status, 200);
        assert.equal(
          result.body.data.departments.find(
            (value: { id: string }) => value.id === departmentId,
          ).attentionReasons.length,
          1,
        );
      },
    );
    await t.test(
      "two organizers cannot overwrite one another with the same plan version",
      async () => {
        const version = (await request(owner, root)).body.data.version;
        const results = await Promise.all([
          change(
            owner,
            {
              action: "updateWork",
              id: departmentId,
              status: "In progress",
              note: "Concurrent update A",
              onBehalf: false,
            },
            version,
          ),
          change(
            organizer,
            {
              action: "updateWork",
              id: departmentId,
              status: "In progress",
              note: "Concurrent update B",
              onBehalf: false,
            },
            version,
          ),
        ]);
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [200, 409],
        );
        const latest = (await request(owner, root)).body.data;
        assert.equal(latest.version, version + 1);
        const history = latest.departments.find(
          (value: { id: string }) => value.id === departmentId,
        ).updates;
        assert.equal(
          history.filter((item: { message: string }) =>
            item.message.startsWith("Concurrent update"),
          ).length,
          1,
        );
      },
    );
    const functionValues = {
      name: "Mehendi",
      startsAt: "2027-04-17T16:00",
      endsAt: "2027-04-17T18:00",
      venue: "Family Courtyard",
      address: "Gate 1, family home",
      city: "Jaipur",
      guestVisible: true,
    };
    await t.test(
      "function intervals use IST, reject overlaps and enforce organizer access",
      async () => {
        assert.equal(
          (
            await change(worker, {
              action: "addFunction",
              values: functionValues,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: { ...functionValues, startsAt: "2027-04-17T16:00Z" },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: { ...functionValues, endsAt: "2027-04-17T15:00" },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: {
                ...functionValues,
                startsAt: "2027-04-19T00:30",
                endsAt: "2027-04-19T02:00",
              },
            })
          ).body.error.code,
          "FUNCTION_OVERLAP",
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: functionValues,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: { ...functionValues, name: "Overlapping Mehendi" },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await change(owner, {
              action: "addFunction",
              values: {
                ...functionValues,
                name: "Family rehearsal",
                startsAt: "2027-04-17T18:00",
                endsAt: "2027-04-17T19:00",
                guestVisible: false,
              },
            })
          ).status,
          200,
        );
        const wedding = await Wedding.findById(weddingId);
        const conflictingMain = await request(
          owner,
          "/weddings/current",
          "PATCH",
          {
            ...weddingValues,
            date: "2027-04-17",
            startTime: "17:00",
            endTime: "18:00",
            version: wedding!.__v,
          },
        );
        assert.equal(conflictingMain.status, 422);
        const version = (await request(owner, root)).body.data.version;
        const pair = await Promise.all([
          change(
            owner,
            {
              action: "addFunction",
              values: {
                ...functionValues,
                name: "Haldi",
                startsAt: "2027-04-17T10:00",
                endsAt: "2027-04-17T12:00",
              },
            },
            version,
          ),
          change(
            organizer,
            {
              action: "addFunction",
              values: {
                ...functionValues,
                name: "Family brunch",
                startsAt: "2027-04-17T11:00",
                endsAt: "2027-04-17T13:00",
              },
            },
            version,
          ),
        ]);
        assert.deepEqual(
          pair.map((result) => result.status).sort(),
          [200, 409],
        );
      },
    );
    await t.test(
      "public function projection hides private ceremonies and all work data",
      async () => {
        const visible = await request(
          { cookie: "" },
          "/public/weddings/" + publicId + "/functions",
        );
        assert.equal(visible.status, 200);
        assert.ok(
          visible.body.data.some(
            (item: { name: string }) => item.name === "Mehendi",
          ),
        );
        assert.ok(!JSON.stringify(visible.body).includes("Family rehearsal"));
        assert.ok(
          !JSON.stringify(visible.body).includes("Private stage instructions"),
        );
        for (const item of visible.body.data)
          assert.deepEqual(
            Object.keys(item).sort(),
            [
              "id",
              "name",
              "startsAt",
              "endsAt",
              "venue",
              "address",
              "city",
            ].sort(),
          );
        const wedding = await request(owner, "/public/weddings/" + publicId);
        assert.equal(wedding.body.data.planning, undefined);
      },
    );
    await t.test(
      "a wedding created before planning can save without a migration",
      async () => {
        await Wedding.updateOne(
          { _id: weddingId },
          { $unset: { planning: 1 } },
        );
        const initial = await request(owner, root);
        assert.equal(initial.body.data.version, 0);
        const saved = await change(owner, { action: "applyTemplate" }, 0);
        assert.equal(saved.status, 200);
        assert.equal(saved.body.data.departments.length, 5);
      },
    );
    await t.test(
      "removed members lose planning access immediately",
      async () => {
        await change(owner, {
          action: "addDepartment",
          values: { ...departmentValues, memberIds: [worker.id] },
        });
        const removed = await request(
          owner,
          "/weddings/current/members/" + worker.id,
          "DELETE",
        );
        assert.equal(removed.status, 200);
        const latest = await Wedding.findById(weddingId);
        assert.ok(
          latest!.planning!.departments.every((department) =>
            department.memberIds.every(
              (member) => member.toString() !== worker.id,
            ),
          ),
        );
        assert.equal((await request(worker, root)).status, 409);
        assert.equal(
          (
            await request(worker, root, "PATCH", {
              action: "applyTemplate",
              version: 1,
            })
          ).status,
          409,
        );
      },
    );
  },
);
