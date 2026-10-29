import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";

test(
  "real family → wedding → dashboard flow, guest synchronization and organizer permissions",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("wedding_flow_test");
    process.env.SESSION_SECRET =
      "isolated-wedding-flow-test-secret-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    const { connectDatabase, disconnectDatabase } =
      await import("../../config/database.js");
    const { createApp } = await import("../../app.js");
    const { Wedding, Family } = await import("./wedding.models.js");
    let server: ReturnType<typeof createServer> | undefined;
    t.after(async () => {
      const running = server;
      if (running) {
        running.closeAllConnections();
        await new Promise<void>((resolve) => running.close(() => resolve()));
      }
      await disconnectDatabase();
      await mongo.stop();
    });
    await connectDatabase();
    server = createServer(createApp());
    const running = server;
    await new Promise<void>((resolve) =>
      running.listen(0, "127.0.0.1", resolve),
    );
    const address = running.address();
    if (!address || typeof address === "string")
      throw new Error("Missing port");
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    type Client = { cookie: string; id?: string };
    const owner: Client = { cookie: "" };
    const stranger: Client = { cookie: "" };
    async function request(
      client: Client,
      path: string,
      method = "GET",
      body?: unknown,
      withCsrf = true,
    ) {
      let token = "";
      if (method !== "GET" && withCsrf)
        token = (await request(client, "/auth/csrf")).body.data.token;
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
    async function account(client: Client, email: string) {
      const response = await request(client, "/auth/signup", "POST", {
        name: "Wedding Test",
        email,
        password: "Disposable-Wedding-2027",
      });
      assert.equal(response.status, 201);
      client.id = response.body.data.id;
    }
    const input = {
      brideName: "Test Bride",
      groomName: "Test Groom",
      date: "2027-04-18",
      startTime: "20:30",
      endTime: "01:00",
      venue: "Test Wedding Lawn",
      address: "Test venue street, gate two",
      city: "Test City",
      latitude: 28.61,
      longitude: 77.2,
      contactRole: "Family coordinator",
      phone: "+919999000000",
      welcome: "Welcome to our celebration.",
      youtube: "",
    };
    let publicId = "";
    let version = 0;
    await t.test(
      "anonymous requests cannot read private setup or dashboard",
      async () => {
        assert.equal((await request(owner, "/setup")).status, 401);
        assert.equal((await request(owner, "/dashboard")).status, 401);
        assert.equal(
          (await request(owner, "/public/weddings/missing")).status,
          404,
        );
      },
    );
    await t.test(
      "new account has no dashboard and receives the setup redirect instruction",
      async () => {
        await account(owner, "owner@example.com");
        const result = await request(owner, "/dashboard");
        assert.equal(result.status, 409);
        assert.equal(result.body.error.code, "WEDDING_REQUIRED");
        assert.equal(result.body.error.redirectTo, "/app/setup");
        assert.equal((await request(owner, "/setup")).body.data.family, null);
        assert.equal(
          (await request(owner, "/weddings", "POST", input)).body.error.code,
          "FAMILY_REQUIRED",
        );
      },
    );
    await t.test(
      "family registration is account-scoped, rejects ownership injection and persists once",
      async () => {
        assert.equal(
          (
            await request(owner, "/families", "POST", {
              name: "Test Family",
              side: "Both",
              owner: "someone-else",
            })
          ).status,
          422,
        );
        const result = await request(owner, "/families", "POST", {
          name: "Test Family",
          side: "Both",
        });
        assert.equal(result.status, 201);
        assert.equal(result.body.data.family.name, "Test Family");
        assert.equal(result.body.data.wedding, null);
        assert.equal(
          (
            await request(owner, "/families", "POST", {
              name: "Again",
              side: "Bride",
            })
          ).status,
          409,
        );
        assert.equal(
          (await Family.findOne({ owner: owner.id }))?.name,
          "Test Family",
        );
      },
    );
    await t.test(
      "wedding validation rejects invalid dates, incomplete coordinates and role injection",
      async () => {
        for (const body of [
          { ...input, date: "2027-02-30" },
          { ...input, longitude: null },
          { ...input, members: [] },
          { ...input, youtube: "https://evil.example/video" },
        ])
          assert.equal(
            (await request(owner, "/weddings", "POST", body)).status,
            422,
          );
        assert.equal(
          (await request(owner, "/weddings", "POST", input, false)).status,
          403,
        );
      },
    );
    await t.test(
      "creating a wedding enables a real dashboard without sample content",
      async () => {
        const result = await request(owner, "/weddings", "POST", input);
        assert.equal(result.status, 201);
        assert.equal(result.body.data.role, "Admin");
        assert.equal(result.body.data.wedding.brideName, input.brideName);
        publicId = result.body.data.wedding.publicId;
        version = result.body.data.wedding.version;
        const dashboard = await request(owner, "/dashboard");
        assert.equal(dashboard.status, 200);
        assert.equal(dashboard.body.data.wedding.publicId, publicId);
        assert.equal(dashboard.body.data.family.name, "Test Family");
        assert.equal(JSON.stringify(dashboard.body).includes("Aditi"), false);
        assert.equal(
          (await request(owner, "/weddings", "POST", input)).status,
          409,
        );
      },
    );
    await t.test(
      "public website is login-free and only exposes intended guest details",
      async () => {
        const response = await request(
          { cookie: "" },
          "/public/weddings/" + publicId,
        );
        assert.equal(response.status, 200);
        assert.equal(response.body.data.date, input.date);
        for (const privateField of [
          "members",
          "createdBy",
          "family",
          "email",
          "passwordHash",
          "_id",
          "version",
        ])
          assert.equal(privateField in response.body.data, false);
        assert.equal(response.body.data.phone, input.phone);
      },
    );
    await t.test(
      "another account cannot see or edit this wedding",
      async () => {
        await account(stranger, "stranger@example.com");
        const setup = await request(stranger, "/setup");
        assert.equal(setup.body.data.wedding, null);
        assert.equal(setup.body.data.family, null);
        assert.equal((await request(stranger, "/dashboard")).status, 409);
        assert.equal(
          (
            await request(stranger, "/weddings/current", "PATCH", {
              ...input,
              version,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "organizer edits persist to MongoDB and update guest output with a stable link",
      async () => {
        const updated = {
          ...input,
          date: "2027-05-20",
          venue: "Updated Venue",
          city: "Updated City",
          latitude: null,
          longitude: null,
        };
        const result = await request(owner, "/weddings/current", "PATCH", {
          ...updated,
          version,
        });
        assert.equal(result.status, 200);
        assert.equal(result.body.data.wedding.publicId, publicId);
        assert.equal(result.body.data.wedding.version, version + 1);
        version++;
        const guest = await request(
          { cookie: "" },
          "/public/weddings/" + publicId,
        );
        assert.equal(guest.body.data.date, updated.date);
        assert.equal(guest.body.data.venue, updated.venue);
        assert.equal(
          (await Wedding.findOne({ publicId }))?.city,
          "Updated City",
        );
        const stale = await request(owner, "/weddings/current", "PATCH", {
          ...input,
          version: version - 1,
        });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.error.code, "WEDDING_CONFLICT");
        assert.equal(
          (await request(owner, "/dashboard")).body.data.wedding.date,
          updated.date,
        );
      },
    );
    await t.test(
      "manager and worker memberships can read but cannot edit",
      async () => {
        for (const role of ["Manager", "Worker"]) {
          const client: Client = { cookie: "" };
          await account(client, role.toLowerCase() + "@example.com");
          await Wedding.updateOne(
            { publicId },
            { $push: { members: { userId: client.id, role } } },
          );
          assert.equal(
            (await request(client, "/dashboard")).body.data.role,
            role,
          );
          assert.equal(
            (
              await request(client, "/weddings/current", "PATCH", {
                ...input,
                version,
              })
            ).status,
            403,
          );
        }
      },
    );
    await t.test(
      "concurrent organizer updates reject a stale writer",
      async () => {
        const token = (await request(owner, "/auth/csrf")).body.data.token;
        const send = (city: string) =>
          fetch(base + "/weddings/current", {
            method: "PATCH",
            headers: {
              Cookie: owner.cookie,
              Origin: process.env.APP_ORIGIN!,
              "Content-Type": "application/json",
              "X-CSRF-Token": token,
            },
            body: JSON.stringify({ ...input, city, version }),
          });
        const responses = await Promise.all([
          send("First update"),
          send("Second update"),
        ]);
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        );
        for (const response of responses) await response.arrayBuffer();
      },
    );
  },
);
