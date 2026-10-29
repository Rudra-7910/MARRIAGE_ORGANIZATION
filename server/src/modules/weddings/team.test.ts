import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "wedding invitation roles, atomic acceptance and private access",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("team_access_test");
    process.env.SESSION_SECRET =
      "team-invites-isolated-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    const { connectDatabase, disconnectDatabase } = await import(
      "../../config/database.js"
    );
    const { createApp } = await import("../../app.js");
    const { Wedding } = await import("./wedding.models.js");
    await connectDatabase();
    const server = createServer(createApp());
    t.after(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing port");
    const base = "http://127.0.0.1:" + address.port + "/api/v1";
    type Client = { cookie: string; id?: string };
    const owner: Client = { cookie: "" };
    const organizer: Client = { cookie: "" };
    const admin: Client = { cookie: "" };
    const manager: Client = { cookie: "" };
    const worker: Client = { cookie: "" };
    const outsider: Client = { cookie: "" };
    const anotherOwner: Client = { cookie: "" };
    const root = "/weddings/current";
    async function request(
      client: Client,
      path: string,
      method = "GET",
      body?: unknown,
      csrf = true,
      origin = process.env.APP_ORIGIN!,
    ) {
      let token = "";
      if (method !== "GET" && csrf)
        token = (await request(client, "/auth/csrf")).body.data.token;
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: client.cookie,
          Origin: origin,
          "Content-Type": "application/json",
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const cookie = response.headers.get("set-cookie");
      if (cookie) client.cookie = cookie.split(";")[0];
      return { status: response.status, body: await response.json() };
    }
    async function account(client: Client, email: string) {
      const result = await request(client, "/auth/signup", "POST", {
        name: email.split("@")[0],
        email,
        password: "Disposable-Team-Test-2027",
      });
      assert.equal(result.status, 201);
      client.id = result.body.data.id;
    }
    const weddingInput = {
      brideName: "Team Bride",
      groomName: "Team Groom",
      date: "2027-04-18",
      startTime: "18:00",
      endTime: "",
      venue: "Test Family Garden",
      address: "Test street, gate two",
      city: "Lucknow",
      latitude: null,
      longitude: null,
      contactRole: "Family coordinator",
      phone: "+919999000000",
      welcome: "",
      youtube: "",
    };
    async function weddingFor(client: Client) {
      assert.equal(
        (
          await request(client, "/families", "POST", {
            name: "Test family",
            side: "Both",
          })
        ).status,
        201,
      );
      assert.equal(
        (await request(client, "/weddings", "POST", weddingInput)).status,
        201,
      );
    }
    async function invite(client: Client, role: string) {
      const result = await request(client, root + "/team-invites", "POST", {
        role,
      });
      assert.equal(result.status, 201);
      return {
        ...result.body.data,
        token: new URL(result.body.data.url).hash.slice(1),
      };
    }
    async function accept(client: Client, token: string, extra = {}) {
      return request(client, "/team-invites/accept", "POST", {
        token,
        ...extra,
      });
    }
    await account(owner, "creator@example.com");
    await weddingFor(owner);
    for (const [client, email] of [
      [organizer, "organizer"],
      [admin, "admin"],
      [manager, "manager"],
      [worker, "worker"],
      [outsider, "outsider"],
      [anotherOwner, "another-owner"],
    ] as const)
      await account(client, email + "@example.com");
    await weddingFor(anotherOwner);
    let workerToken = "";

    await t.test(
      "creator is a protected wedding Admin and all staff start without access",
      async () => {
        assert.equal(
          (await request(owner, "/dashboard")).body.data.role,
          "Admin",
        );
        const team = (await request(owner, root + "/team")).body.data;
        assert.deepEqual(team.allowedRoles, [
          "Admin",
          "Organizer",
          "Manager",
          "Worker",
        ]);
        assert.equal(team.members[0].isCreator, true);
        assert.equal(team.members[0].canRemove, false);
        assert.equal((await request(worker, "/dashboard")).status, 409);
        assert.equal(
          (await request({ cookie: "" }, root + "/team")).status,
          401,
        );
        assert.equal(
          (await request({ cookie: "" }, root + "/budget")).status,
          401,
        );
      },
    );
    await t.test(
      "preview cannot grant access; database stores a hash and responses expose only public invite details",
      async () => {
        const link = await invite(owner, "Worker");
        assert.match(link.token, /^[a-f0-9]{64}$/);
        const saved = await Wedding.findOne({ createdBy: owner.id });
        assert.equal(JSON.stringify(saved).includes(link.token), false);
        assert.equal(
          saved!.teamInvites.at(-1)!.tokenHash,
          createHash("sha256").update(link.token).digest("hex"),
        );
        const result = await request(
          { cookie: "" },
          "/team-invites/preview",
          "POST",
          { token: link.token },
          false,
        );
        assert.equal(result.status, 200);
        assert.deepEqual(Object.keys(result.body.data).sort(), [
          "brideName",
          "date",
          "expiresAt",
          "groomName",
          "role",
        ]);
        assert.equal(result.body.data.role, "Worker");
        assert.equal((await request(worker, "/dashboard")).status, 409);
        assert.equal(
          (
            await request(
              { cookie: "" },
              "/team-invites/accept",
              "POST",
              { token: link.token },
              false,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await request(
              owner,
              root + "/team-invites",
              "POST",
              { role: "Worker" },
              false,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              owner,
              root + "/team-invites",
              "POST",
              { role: "Worker" },
              true,
              "https://untrusted.example",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(owner, root + "/team-invites", "POST", {
              role: "Worker",
              weddingId: "spoof",
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(worker, root + "/team-invites", "POST", {
              role: "Admin",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "all four roles are granted from saved invitations, never from client role fields",
      async () => {
        for (const [client, role] of [
          [organizer, "Organizer"],
          [admin, "Admin"],
          [manager, "Manager"],
          [worker, "Worker"],
        ] as const) {
          const link = await invite(owner, role);
          assert.equal(
            (await accept(client, link.token, { role: "Admin" })).status,
            422,
          );
          const result = await accept(client, link.token);
          assert.equal(result.status, 200);
          assert.equal(result.body.data.role, role);
          assert.equal(
            (await request(client, "/dashboard")).body.data.role,
            role,
          );
          if (role === "Worker") workerToken = link.token;
        }
        assert.equal((await accept(worker, workerToken)).status, 200);
        assert.equal((await accept(outsider, workerToken)).status, 410);
        assert.equal(
          (
            await request(
              { cookie: "" },
              "/team-invites/preview",
              "POST",
              { token: workerToken },
              false,
            )
          ).status,
          410,
        );
      },
    );
    await t.test(
      "Workers and Managers cannot read finance or guests; Admins and Organizers retain access",
      async () => {
        for (const client of [manager, worker]) {
          assert.equal((await request(client, root + "/budget")).status, 403);
          assert.equal(
            (await request(client, root + "/budget/private", "PATCH", {}))
              .status,
            403,
          );
          assert.equal((await request(client, root + "/guests")).status, 403);
          const team = (await request(client, root + "/team")).body.data;
          assert.equal(
            JSON.stringify(team).includes("creator@example.com"),
            false,
          );
          assert.equal(JSON.stringify(team).includes("tokenHash"), false);
        }
        for (const client of [owner, admin, organizer]) {
          const response = await request(client, root + "/budget");
          assert.equal(response.status, 200);
          assert.equal(response.body.data.available, false);
          assert.equal((await request(client, root + "/guests")).status, 200);
        }
        for (const role of ["Admin", "Organizer", "Manager"])
          assert.equal(
            (await request(worker, root + "/team-invites", "POST", { role }))
              .status,
            403,
          );
        assert.equal(
          (
            await request(manager, root + "/team-invites", "POST", {
              role: "Organizer",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(organizer, root + "/team-invites", "POST", {
              role: "Admin",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(admin, root + "/team-invites", "POST", {
              role: "Organizer",
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "revoked, expired, invalid and no-longer-authorized invitations cannot be accepted",
      async () => {
        const revoked = await invite(owner, "Worker");
        assert.equal(
          (await request(owner, root + "/team-invites/" + revoked.id, "DELETE"))
            .status,
          200,
        );
        assert.equal((await accept(outsider, revoked.token)).status, 410);
        const expired = await invite(owner, "Worker");
        await Wedding.updateOne(
          { createdBy: owner.id, "teamInvites._id": expired.id },
          { $set: { "teamInvites.$.expiresAt": new Date(0) } },
        );
        assert.equal((await accept(outsider, expired.token)).status, 410);
        assert.equal((await accept(outsider, "f".repeat(64))).status, 410);
        const managerInvite = await invite(manager, "Worker");
        await Wedding.updateOne(
          { createdBy: owner.id, "members.userId": manager.id },
          { $set: { "members.$.role": "Worker" }, $inc: { __v: 1 } },
        );
        assert.equal((await accept(outsider, managerInvite.token)).status, 410);
        await Wedding.updateOne(
          { createdBy: owner.id, "members.userId": manager.id },
          { $set: { "members.$.role": "Manager" }, $inc: { __v: 1 } },
        );
      },
    );
    await t.test(
      "creator is protected; manager scope and cross-wedding identifiers cannot bypass permissions",
      async () => {
        for (const client of [owner, admin, organizer, manager, worker])
          assert.equal(
            (await request(client, root + "/members/" + owner.id, "DELETE"))
              .status,
            403,
          );
        assert.equal(
          (await request(organizer, root + "/members/" + admin.id, "DELETE"))
            .status,
          403,
        );
        assert.equal(
          (await request(manager, root + "/members/" + worker.id, "DELETE"))
            .status,
          403,
        );
        const link = await invite(anotherOwner, "Worker");
        assert.equal(
          (await request(owner, root + "/team-invites/" + link.id, "DELETE"))
            .status,
          404,
        );
        assert.equal(
          (await request(owner, root + "/members/" + anotherOwner.id, "DELETE"))
            .status,
          404,
        );
        assert.equal((await accept(worker, link.token)).status, 409);
        assert.equal(
          (await request(worker, "/dashboard")).body.data.role,
          "Worker",
        );
        const managerLink = await invite(manager, "Worker");
        assert.equal((await accept(outsider, managerLink.token)).status, 200);
        assert.equal(
          (await request(manager, root + "/members/" + outsider.id, "DELETE"))
            .status,
          200,
        );
        assert.equal((await request(outsider, "/dashboard")).status, 409);
        assert.equal((await accept(outsider, managerLink.token)).status, 410);
      },
    );
    await t.test(
      "removal stops existing sessions accessing private APIs and revokes the removed inviter’s pending links",
      async () => {
        const link = await invite(organizer, "Worker");
        assert.equal(
          (await request(owner, root + "/members/" + organizer.id, "DELETE"))
            .status,
          200,
        );
        assert.equal((await request(organizer, "/auth/me")).status, 200);
        assert.equal((await request(organizer, "/dashboard")).status, 409);
        assert.equal((await request(organizer, root + "/guests")).status, 409);
        assert.equal((await request(organizer, root + "/budget")).status, 409);
        assert.equal((await accept(outsider, link.token)).status, 410);
        const saved = await Wedding.findOne({ createdBy: owner.id });
        assert.ok(saved!.teamInvites.id(link.id)!.revokedAt);
      },
    );
    await t.test(
      "two accounts racing for one link produce one membership and one consumption",
      async () => {
        const left: Client = { cookie: "" },
          right: Client = { cookie: "" };
        await account(left, "race-left@example.com");
        await account(right, "race-right@example.com");
        const link = await invite(owner, "Worker");
        const results = await Promise.all([
          accept(left, link.token),
          accept(right, link.token),
        ]);
        assert.equal(results.filter((item) => item.status === 200).length, 1);
        assert.ok(
          results.every((item) => [200, 409, 410].includes(item.status)),
        );
        const saved = await Wedding.findOne({ createdBy: owner.id });
        const winner = saved!.teamInvites.id(link.id)!.acceptedBy!.toString();
        assert.ok([left.id, right.id].includes(winner));
        assert.equal(
          saved!.members.filter((item) =>
            [left.id, right.id].includes(item.userId.toString()),
          ).length,
          1,
        );
      },
    );
    await t.test(
      "one account racing to join two weddings cannot consume both invitations",
      async () => {
        const client: Client = { cookie: "" };
        await account(client, "two-weddings@example.com");
        const first = await invite(owner, "Worker"),
          second = await invite(anotherOwner, "Worker");
        const results = await Promise.all([
          accept(client, first.token),
          accept(client, second.token),
        ]);
        assert.equal(results.filter((item) => item.status === 200).length, 1);
        assert.equal(
          await Wedding.countDocuments({ "members.userId": client.id }),
          1,
        );
        const rows = await Wedding.find({
          "teamInvites.acceptedBy": client.id,
        });
        assert.equal(rows.length, 1);
        assert.equal(
          (
            await accept(
              client,
              results[0].status === 200 ? first.token : second.token,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "an older Organizer creator retains Admin controls without migrating its stored membership",
      async () => {
        await Wedding.updateOne(
          { createdBy: owner.id, "members.userId": owner.id },
          { $set: { "members.$.role": "Organizer" }, $inc: { __v: 1 } },
        );
        assert.equal(
          (await request(owner, "/dashboard")).body.data.role,
          "Admin",
        );
        assert.equal((await invite(owner, "Organizer")).role, "Organizer");
        const result = await request(owner, root + "/team");
        assert.deepEqual(result.body.data.allowedRoles, [
          "Admin",
          "Organizer",
          "Manager",
          "Worker",
        ]);
      },
    );
  },
);
