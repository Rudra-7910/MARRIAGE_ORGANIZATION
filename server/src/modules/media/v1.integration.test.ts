import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import sharp from "sharp";
import type { ClientSession, QueryFilter, UpdateQuery } from "mongoose";
import type { WeddingDocument } from "../weddings/wedding.models.js";
import { io as connectSocket, type Socket } from "socket.io-client";

test(
  "remaining V1 flows use real database permissions and private object storage",
  { timeout: 120000 },
  async (t) => {
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const objects = new Map<string, Buffer>();
    const objectServer = createServer(async (req, res) => {
      const url = new URL(req.url!, "http://storage.test");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      if (req.method === "PUT") {
        objects.set(url.pathname, body);
        res.setHeader("ETag", '"test-etag"');
        res.end();
        return;
      }
      if (req.method === "POST" && url.searchParams.has("delete")) {
        for (const match of body.toString().matchAll(/<Key>(.*?)<\/Key>/g))
          objects.delete("/photos/" + match[1]);
        res.setHeader("Content-Type", "application/xml");
        res.end(
          '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>',
        );
        return;
      }
      const object = objects.get(url.pathname);
      if (!object) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("Content-Length", object.length);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      if (req.headers.range) {
        res.statusCode = 206;
        res.setHeader(
          "Content-Range",
          "bytes 0-" + (object.length - 1) + "/" + object.length,
        );
      }
      res.end(object);
    });
    await new Promise<void>((resolve) =>
      objectServer.listen(0, "127.0.0.1", resolve),
    );
    const storageAddress = objectServer.address();
    assert.ok(storageAddress && typeof storageAddress !== "string");
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri("remaining_v1");
    process.env.SESSION_SECRET =
      "test-secret-for-v1-integration-at-least-32-characters";
    process.env.LINK_SECRET = "link-secret-for-v1-tests-at-least-32-characters";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.TRUST_PROXY_CIDRS = "";
    process.env.AWS_REGION = "ap-south-1";
    process.env.AWS_ENDPOINT_URL_S3 = "http://127.0.0.1:" + storageAddress.port;
    process.env.AWS_ACCESS_KEY_ID = "fake-test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "fake-test-secret";
    process.env.AWS_SESSION_TOKEN = "";
    process.env.AWS_PROFILE = "";
    process.env.AWS_ROLE_ARN = "";
    process.env.S3_BUCKET = "photos";
    process.env.GOOGLE_PLACES_API_KEY = "";
    process.env.GOOGLE_TRANSLATION_API_KEY = "";
    process.env.PLATFORM_MODERATOR_USER_IDS = "";
    const { connectDatabase, disconnectDatabase } = await import(
      "../../config/database.js"
    );
    const { createApp } = await import("../../app.js");
    const { attachRealtime } = await import("../../config/realtime.js");
    const { Wedding, Family } = await import("../weddings/wedding.models.js");
    const { Guest } = await import("../invitations/invitation.model.js");
    const { Photo } = await import("./media.models.js");
    const { accessToken } = await import("../site/access-token.js");
    await connectDatabase();
    const app = createApp({
      sendEmail: async () => {
        throw new Error("Tests must never send real email.");
      },
    });
    const server = createServer(app);
    const realtime = attachRealtime(server, app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = "http://127.0.0.1:" + address.port;
    const sockets: Socket[] = [];
    t.after(async () => {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve) => realtime.close(() => resolve()));
      objectServer.closeAllConnections();
      await new Promise<void>((resolve) => objectServer.close(() => resolve()));
      await disconnectDatabase();
      await mongo.stop();
    });
    type Client = { cookie: string; id?: string };
    const owner: Client = { cookie: "" },
      organizer: Client = { cookie: "" },
      worker: Client = { cookie: "" },
      provider: Client = { cookie: "" },
      anonymous: Client = { cookie: "" };
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
      const response = await fetch(origin + "/api/v1" + path, {
        method,
        headers: {
          Cookie: client.cookie,
          Origin: process.env.APP_ORIGIN!,
          "Content-Type": "application/json",
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
      });
      const cookie = response.headers.get("set-cookie");
      if (cookie) client.cookie = cookie.split(";")[0];
      return {
        status: response.status,
        body: response.status === 302 ? {} : await response.json(),
        location: response.headers.get("location"),
      };
    }
    for (const [index, client] of [
      owner,
      organizer,
      worker,
      provider,
    ].entries()) {
      const result = await request(client, "/auth/signup", "POST", {
        name: "V1 member " + index,
        email: "v1-" + index + "@example.com",
        password: "Disposable-test-2027",
      });
      assert.equal(result.status, 201);
      client.id = result.body.data.id;
    }
    const family = await Family.create({
      owner: owner.id,
      name: "Sharma & Rao families",
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
      phone: "+919999000000",
      contactRole: "Family coordinator",
      members: [
        { userId: owner.id, role: "Admin" },
        { userId: organizer.id, role: "Organizer" },
        { userId: worker.id, role: "Worker" },
      ],
      planning: {
        functions: [
          {
            name: "Family mehendi",
            startsAt: "2027-04-16T17:00",
            endsAt: "2027-04-16T20:00",
            venue: "Family home",
            address: "12 Civil Lines",
            city: "Jaipur",
            guestVisible: false,
          },
        ],
      },
    });
    const publicId = wedding.publicId,
      functionId = wedding.planning!.functions[0]._id.toString();
    let guestId = "",
      token = "",
      grantId = "",
      uploadToken = "",
      photoId = "",
      providerId = "",
      departmentId = "";
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#457565" },
    })
      .png()
      .toBuffer();
    await t.test(
      "private function links and scoped announcements never appear on the generic guest site",
      async () => {
        const guest = await request(owner, "/weddings/current/guests", "POST", {
          name: "Rao family",
          email: "rao@example.com",
          side: "Groom",
        });
        assert.equal(guest.status, 201);
        guestId = guest.body.data.id;
        const access = await request(
          owner,
          "/weddings/current/guests/" + guestId + "/access",
          "PATCH",
          {
            version: guest.body.data.version,
            functionIds: [functionId],
            revoked: false,
          },
        );
        assert.equal(access.status, 200);
        token = access.body.data.url.split("#invite=")[1];
        assert.equal(
          (
            await request(
              anonymous,
              "/public/weddings/" + publicId + "/functions",
            )
          ).body.data.length,
          0,
        );
        let site = await request(owner, "/weddings/current/announcements");
        assert.equal(
          (
            await request(owner, "/weddings/current/announcements", "PATCH", {
              action: "add",
              version: site.body.data.version,
              values: {
                title: "Mehendi timing",
                text: "Please enter through the east gate.",
                scope: "functions",
                functionIds: [functionId],
                published: true,
              },
            })
          ).status,
          200,
        );
        site = await request(owner, "/weddings/current/announcements");
        assert.equal(
          (
            await request(owner, "/weddings/current/announcements", "PATCH", {
              action: "add",
              version: site.body.data.version,
              values: {
                title: "Ceremony update",
                text: "The main gate opens at six.",
                scope: "public",
                functionIds: [],
                published: true,
              },
            })
          ).status,
          200,
        );
        const generic = await request(
          anonymous,
          "/public/weddings/" + publicId + "/announcements",
        );
        assert.deepEqual(
          generic.body.data.map((item: { title: string }) => item.title),
          ["Ceremony update"],
        );
        const personal = await request(
          anonymous,
          "/public/weddings/" + publicId + "/invitation",
          "POST",
          { token },
          false,
        );
        assert.equal(personal.status, 200);
        assert.equal(personal.body.data.functions.length, 1);
        assert.equal(personal.body.data.announcements.length, 2);
        assert.equal(
          JSON.stringify(personal.body).includes("rao@example.com"),
          false,
        );
        assert.equal(
          (await request(worker, "/weddings/current/announcements")).status,
          403,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/public/weddings/" + publicId + "/invitation",
              "POST",
              { token: "0".repeat(64) },
              false,
            )
          ).status,
          404,
        );
        const preview = await request(
          owner,
          "/weddings/current/guests/" + guestId + "/invitation",
        );
        assert.ok(preview.body.data.html.includes("#invite=" + token));
      },
    );
    await t.test("a revoked personal invitation fails closed", async () => {
      const guest = await Guest.findById(guestId);
      assert.ok(guest);
      assert.equal(
        (
          await request(
            owner,
            "/weddings/current/guests/" + guestId + "/access",
            "PATCH",
            { version: guest.__v, functionIds: [functionId], revoked: true },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            anonymous,
            "/public/weddings/" + publicId + "/invitation",
            "POST",
            { token },
            false,
          )
        ).status,
        404,
      );
    });
    await t.test(
      "upload grants enforce CSRF, role and atomic quotas; renewal does not consume another slot",
      async () => {
        assert.equal(
          (
            await request(worker, "/weddings/current/upload-links", "POST", {
              days: 7,
              limit: 1,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              owner,
              "/weddings/current/upload-links",
              "POST",
              { days: 7, limit: 1 },
              false,
            )
          ).status,
          403,
        );
        const grant = await request(
          owner,
          "/weddings/current/upload-links",
          "POST",
          { days: 7, limit: 1 },
        );
        assert.equal(grant.status, 201);
        assert.ok(grant.body.data.qrDataUrl.startsWith("data:image/png"));
        grantId = grant.body.data.id;
        uploadToken = grant.body.data.url.split("#")[1];
        const authorized = await Promise.all(
          [1, 2].map(() =>
            request(
              anonymous,
              "/uploads/authorize",
              "POST",
              {
                token: uploadToken,
                publicId,
                name: "family.png",
                type: "image/png",
                size: png.length,
              },
              false,
            ),
          ),
        );
        assert.deepEqual(
          authorized.map((item) => item.status).sort(),
          [201, 409],
        );
        const signed = authorized.find((item) => item.status === 201)!.body
          .data;
        const uploadUrl = new URL(signed.uploadUrl);
        assert.equal(uploadUrl.origin, process.env.AWS_ENDPOINT_URL_S3);
        assert.ok(
          uploadUrl.searchParams
            .get("X-Amz-Credential")
            ?.includes("/ap-south-1/s3/aws4_request"),
        );
        assert.ok(uploadUrl.pathname.startsWith("/photos/staging/"));
        photoId = signed.id;
        assert.equal(
          (
            await request(
              anonymous,
              "/uploads/info",
              "POST",
              { token: uploadToken, publicId },
              false,
            )
          ).body.data.remaining,
          0,
        );
        const renewed = await request(
          anonymous,
          "/uploads/" + photoId + "/authorize",
          "POST",
          { token: uploadToken, publicId },
          false,
        );
        assert.equal(renewed.status, 200);
        assert.equal(
          (
            await fetch(renewed.body.data.uploadUrl, {
              method: "PUT",
              headers: renewed.body.data.headers,
              body: png,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "server validates and transforms uploads; unapproved images stay private",
      async () => {
        const completed = await request(
          anonymous,
          "/uploads/" + photoId + "/complete",
          "POST",
          { token: uploadToken, publicId },
          false,
        );
        assert.equal(completed.status, 200, JSON.stringify(completed.body));
        assert.equal(completed.body.data.state, "pending");
        assert.equal(
          (
            await request(
              anonymous,
              "/uploads/" + photoId + "/complete",
              "POST",
              { token: uploadToken, publicId },
              false,
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(anonymous, "/public/weddings/" + publicId + "/photos"))
            .body.data.total,
          0,
        );
        assert.equal(
          (await request(anonymous, "/public/photos/" + photoId + "/content"))
            .status,
          404,
        );
        assert.equal(
          (await request(worker, "/weddings/current/photos?state=pending"))
            .status,
          403,
        );
        const pending = await request(
          owner,
          "/weddings/current/photos?state=pending",
        );
        assert.equal(pending.status, 200);
        assert.equal(pending.body.data.photos[0].width, 40);
        assert.equal(pending.body.data.photos[0].state, "pending");
        assert.equal(
          JSON.stringify(pending.body).includes("stagingKey"),
          false,
        );
        const photo = await Photo.findById(photoId).select("+reviewKey");
        assert.ok(photo);
        const actual = objects.get("/photos/" + photo.reviewKey);
        assert.ok(actual);
        assert.equal((await sharp(actual).metadata()).format, "webp");
      },
    );
    await t.test(
      "approval has a version check and unpublishing removes new public access",
      async () => {
        const photo = await Photo.findById(photoId);
        assert.ok(photo);
        const results = await Promise.all(
          [owner, organizer].map((client) =>
            request(client, "/weddings/current/photos/" + photoId, "PATCH", {
              action: "approve",
              version: photo.__v,
            }),
          ),
        );
        assert.deepEqual(
          results.map((result) => result.status).sort(),
          [200, 409],
        );
        const gallery = await request(
          anonymous,
          "/public/weddings/" + publicId + "/photos",
        );
        assert.equal(gallery.body.data.total, 1);
        const content = await request(
          anonymous,
          "/public/photos/" + photoId + "/content",
        );
        assert.equal(content.status, 302);
        assert.ok(content.location?.includes("X-Amz-Signature"));
        const approved = await Photo.findById(photoId);
        assert.ok(approved);
        assert.equal(
          (
            await request(
              owner,
              "/weddings/current/photos/" + photoId,
              "PATCH",
              { action: "unpublish", version: approved.__v },
            )
          ).status,
          200,
        );
        assert.equal(
          (await request(anonymous, "/public/photos/" + photoId + "/download"))
            .status,
          404,
        );
      },
    );
    await t.test(
      "revoked QR grants cannot complete or renew a reserved upload",
      async () => {
        assert.equal(
          (
            await request(
              owner,
              "/weddings/current/upload-links/" + grantId,
              "DELETE",
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/uploads/" + photoId + "/complete",
              "POST",
              { token: uploadToken, publicId },
              false,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/uploads/" + photoId + "/authorize",
              "POST",
              { token: uploadToken, publicId },
              false,
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "provider accounts need no wedding, directory uses real geo search and does not create membership",
      async () => {
        const values = {
          version: 0,
          name: "Rao Family Catering",
          category: "catering",
          description: "Fresh vegetarian wedding meals prepared in Jaipur.",
          phone: "+919999000001",
          address: "12 Civil Lines",
          city: "Jaipur",
          latitude: 26.9124,
          longitude: 75.7873,
          serviceRadiusKm: 80,
          availability: "Contact us for April dates",
          portfolioUrls: ["https://example.com/menu"],
          published: true,
        };
        assert.equal(
          (await request(provider, "/providers/me")).body.data.profile,
          null,
        );
        const saved = await request(provider, "/providers/me", "PUT", values);
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        providerId = saved.body.data.profile.id;
        assert.equal(
          (
            await request(provider, "/providers/me", "PUT", {
              ...values,
              version: 99,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(provider, "/providers/me", "PUT", {
              ...values,
              portfolioUrls: ["http://localhost/secrets"],
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/providers?latitude=26.9124&longitude=75.7873",
            )
          ).body.data.total,
          1,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/providers?latitude=28.6139&longitude=77.2090",
            )
          ).body.data.total,
          0,
        );
        assert.equal(
          (
            await request(
              worker,
              "/providers/" + providerId + "/add-to-wedding",
              "POST",
              {},
            )
          ).status,
          403,
        );
        // A different organizer changes the plan after this request reads it.
        const originalUpdate = Wedding.updateOne.bind(Wedding);
        let planChanged = false;
        const addRace = t.mock.method(
          Wedding,
          "updateOne",
          async (
            filter: QueryFilter<WeddingDocument>,
            update: UpdateQuery<WeddingDocument>,
            options?: { session?: ClientSession },
          ) => {
            if (!planChanged && update?.$set?.["planning.departments"]) {
              planChanged = true;
              await originalUpdate(
                { _id: wedding._id },
                {
                  $push: { "planning.departments": { name: "Family seating" } },
                  $inc: { "planning.version": 1 },
                },
              );
            }
            return originalUpdate(filter, update, options);
          },
        );
        try {
          const conflict = await request(
            owner,
            "/providers/" + providerId + "/add-to-wedding",
            "POST",
            {},
          );
          assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
          assert.equal(planChanged, true);
          const current = await Wedding.findById(wedding._id);
          assert.ok(
            current!.planning!.departments.some(
              (item) => item.name === "Family seating",
            ),
          );
          assert.ok(
            !current!.planning!.departments.some(
              (item) => item.providerId?.toString() === providerId,
            ),
          );
        } finally {
          addRace.mock.restore();
        }
        const added = await request(
          owner,
          "/providers/" + providerId + "/add-to-wedding",
          "POST",
          {},
        );
        assert.equal(added.status, 201, JSON.stringify(added.body));
        departmentId = added.body.data.departmentId;
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/add-to-wedding",
              "POST",
              {},
            )
          ).body.data.departmentId,
          departmentId,
        );
        assert.equal(
          await Wedding.exists({ "members.userId": provider.id }),
          null,
        );
      },
    );
    await t.test(
      "only completed linked services can be reviewed; duplicates and stale edits are rejected",
      async () => {
        const payload = {
          departmentId,
          rating: 5,
          text: "The team served all family guests on time.",
        };
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/reviews",
              "POST",
              payload,
            )
          ).status,
          403,
        );
        await Wedding.updateOne(
          { _id: wedding._id, "planning.departments._id": departmentId },
          {
            $set: { "planning.departments.$.status": "Done" },
            $inc: { __v: 1 },
          },
        );
        // Review eligibility must not survive a concurrent change away from Done.
        const originalUpdate = Wedding.updateOne.bind(Wedding);
        let statusChanged = false;
        const reviewRace = t.mock.method(
          Wedding,
          "updateOne",
          async (
            filter: QueryFilter<WeddingDocument>,
            update: UpdateQuery<WeddingDocument>,
            options?: { session?: ClientSession },
          ) => {
            if (!statusChanged && options?.session && update?.$inc?.__v) {
              statusChanged = true;
              await originalUpdate(
                { _id: wedding._id, "planning.departments._id": departmentId },
                {
                  $set: { "planning.departments.$.status": "In progress" },
                  $inc: { "planning.version": 1 },
                },
              );
            }
            return originalUpdate(filter, update, options);
          },
        );
        try {
          const conflict = await request(
            owner,
            "/providers/" + providerId + "/reviews",
            "POST",
            payload,
          );
          assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
          assert.equal(statusChanged, true);
          const detail = await request(anonymous, "/providers/" + providerId);
          assert.equal(detail.body.data.reviews.length, 0);
        } finally {
          reviewRace.mock.restore();
        }
        await Wedding.updateOne(
          { _id: wedding._id, "planning.departments._id": departmentId },
          {
            $set: { "planning.departments.$.status": "Done" },
            $inc: { "planning.version": 1 },
          },
        );
        assert.equal(
          (
            await request(
              worker,
              "/providers/" + providerId + "/reviews",
              "POST",
              payload,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/reviews",
              "POST",
              payload,
            )
          ).status,
          201,
        );
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/reviews",
              "POST",
              payload,
            )
          ).status,
          409,
        );
        const detail = (await request(owner, "/providers/" + providerId)).body
          .data;
        assert.equal(detail.canReview.length, 0);
        assert.equal(detail.reviews[0].canEdit, true);
        assert.equal(detail.provider.averageRating, 5);
        const review = detail.reviews[0];
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/reviews/" + review.id,
              "PATCH",
              {
                version: review.version,
                rating: 4,
                text: "Very good meals and clear communication.",
              },
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              owner,
              "/providers/" + providerId + "/reviews/" + review.id,
              "PATCH",
              {
                version: review.version,
                rating: 3,
                text: "A stale edit must not overwrite a review.",
              },
            )
          ).status,
          409,
        );
        assert.equal((await request(owner, "/moderation")).status, 403);
        process.env.PLATFORM_MODERATOR_USER_IDS = owner.id!;
        assert.equal(
          (
            await request(owner, "/moderation/reviews/" + review.id, "PATCH", {
              hidden: true,
              reason: "Review disputed, pending verification",
            })
          ).status,
          200,
        );
        const moderated = (await request(anonymous, "/providers/" + providerId))
          .body.data;
        assert.equal(moderated.reviews.length, 0);
        assert.equal(moderated.provider.reviewCount, 0);
      },
    );
    await t.test(
      "optional Google integrations fail clearly without sending credentials or private content",
      async () => {
        assert.equal(
          (await request(anonymous, "/integrations/places?search=Jaipur"))
            .status,
          401,
        );
        assert.equal(
          (await request(owner, "/integrations/places?search=Jaipur")).status,
          503,
        );
        assert.equal(
          (await request(anonymous, "/interface-labels/hi")).status,
          503,
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/interface-labels/hi?text=private-email@example.com",
            )
          ).status,
          503,
        );
      },
    );
    await t.test(
      "translation serves only the cached allowlisted catalog without requiring a private payload",
      async () => {
        const { TranslationCache, interfaceLabels } = await import(
          "../integrations/integration.routes.js"
        );
        const { createHash } = await import("node:crypto");
        const key =
          "hi-" +
          createHash("sha256")
            .update(JSON.stringify(interfaceLabels))
            .digest("hex");
        await TranslationCache.create({
          key,
          labels: { Overview: "अवलोकन", Photos: "तस्वीरें" },
          expiresAt: new Date(Date.now() + 60000),
        });
        const response = await request(
          anonymous,
          "/interface-labels/hi?text=never-translate-private-notes",
        );
        assert.equal(response.status, 200);
        assert.equal(response.body.data.Overview, "अवलोकन");
        assert.equal(
          JSON.stringify(response.body).includes("never-translate"),
          false,
        );
      },
    );
    await t.test(
      "invalid photo bytes cannot become a reviewable or public image",
      async () => {
        const link = await request(
          owner,
          "/weddings/current/upload-links",
          "POST",
          { days: 1, limit: 1 },
        );
        assert.equal(link.status, 201);
        const badToken = link.body.data.url.split("#")[1];
        const bytes = Buffer.from("This is not a real image.");
        const authorized = await request(
          anonymous,
          "/uploads/authorize",
          "POST",
          {
            token: badToken,
            publicId,
            name: "pretend.png",
            type: "image/png",
            size: bytes.length,
          },
          false,
        );
        assert.equal(authorized.status, 201);
        await fetch(authorized.body.data.uploadUrl, {
          method: "PUT",
          headers: authorized.body.data.headers,
          body: bytes,
        });
        const checked = await request(
          anonymous,
          "/uploads/" + authorized.body.data.id + "/complete",
          "POST",
          { token: badToken, publicId },
          false,
        );
        assert.equal(checked.status, 422);
        assert.equal(
          (await Photo.findById(authorized.body.data.id))!.state,
          "rejected",
        );
        assert.equal(
          (
            await request(
              anonymous,
              "/public/photos/" + authorized.body.data.id + "/content",
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "Socket.IO authenticates sessions, sends no finance payload, and disconnects removed members",
      async () => {
        const anonymousSocket = connectSocket(origin, {
          transports: ["websocket"],
          reconnection: false,
          extraHeaders: { Origin: process.env.APP_ORIGIN! },
        });
        sockets.push(anonymousSocket);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Expected anonymous socket rejection")),
            3000,
          );
          anonymousSocket.once("connect_error", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        async function socketFor(client: Client) {
          const socket = connectSocket(origin, {
            transports: ["websocket"],
            reconnection: false,
            extraHeaders: {
              Cookie: client.cookie,
              Origin: process.env.APP_ORIGIN!,
            },
          });
          sockets.push(socket);
          await new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
          });
          return socket;
        }
        const ownerSocket = await socketFor(owner),
          workerSocket = await socketFor(worker);
        const workerEvents: unknown[] = [];
        workerSocket.on("workspace:changed", (event) =>
          workerEvents.push(event),
        );
        const notice = new Promise<{ resource: string }>((resolve) =>
          ownerSocket.once("workspace:changed", resolve),
        );
        const finance = (await request(owner, "/weddings/current/budget")).body
          .data;
        assert.equal(
          (
            await request(owner, "/weddings/current/budget", "PATCH", {
              action: "setBudget",
              version: finance.version,
              budgetPaise: 1234500,
            })
          ).status,
          200,
        );
        assert.deepEqual(await notice, { resource: "finance" });
        assert.deepEqual(workerEvents, []);
        const disconnected = new Promise<void>((resolve) =>
          workerSocket.once("disconnect", () => resolve()),
        );
        assert.equal(
          (
            await request(
              owner,
              "/weddings/current/members/" + worker.id,
              "DELETE",
            )
          ).status,
          200,
        );
        await disconnected;
        assert.equal(
          (await request(worker, "/weddings/current/photos")).status,
          409,
        );
        const logout = new Promise<void>((resolve) =>
          ownerSocket.once("disconnect", () => resolve()),
        );
        assert.equal(
          (await request(owner, "/auth/logout", "POST", {})).status,
          200,
        );
        await logout;
      },
    );
    // Link lookup uses a hash; protected frozen-email snapshots are handled separately.
    const stored = await Guest.findById(guestId).select(
      "+accessNonce +accessHash",
    );
    assert.ok(stored?.accessNonce);
    assert.notEqual(
      stored.accessHash,
      accessToken("guest", guestId, stored.accessNonce),
    );
  },
);
