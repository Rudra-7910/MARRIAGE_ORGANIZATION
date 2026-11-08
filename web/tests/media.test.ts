import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { api } from "../src/lib/api";
import {
  authorizeUpload,
  completeUpload,
  createUploadLink,
  getPhotos,
  getPublicPhotos,
  getUploadInfo,
  moderatePhoto,
  putPhoto,
  revokeUploadLink,
  renewUpload,
} from "../src/lib/media";
import type { PhotoPage } from "../src/lib/media";
import type { Workspace } from "../src/lib/weddings";
import { PhotosPage } from "../src/features/weddings/PhotosPage";
import { PublicGallery } from "../src/features/media/PublicGallery";

test("photo client keeps moderation CSRF, upload capabilities and signed storage requests separate", async (t) => {
  const requests: {
    url: string;
    method: string;
    csrf?: string;
    cookie?: string;
    authorization?: string;
    type?: string;
    body: unknown;
  }[] = [];
  let port = 0;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    requests.push({
      url: req.url!,
      method: req.method!,
      csrf: req.headers["x-csrf-token"] as string | undefined,
      cookie: req.headers.cookie,
      authorization: req.headers.authorization,
      type: req.headers["content-type"],
      body:
        raw && req.headers["content-type"]?.includes("application/json")
          ? JSON.parse(raw)
          : raw,
    });
    res.setHeader("Content-Type", "application/json");
    let data: unknown = {};
    if (req.url?.endsWith("/csrf")) data = { token: "photo-csrf" };
    else if (
      req.url === "/api/v1/uploads/authorize" ||
      req.url === "/api/v1/uploads/photo%2Fa/authorize"
    )
      data = {
        id: "photo/a",
        uploadUrl:
          "http://127.0.0.1:" +
          port +
          "/private-storage?signature=storage-capability",
        headers: { "Content-Type": "image/jpeg" },
      };
    else if (req.url === "/api/v1/uploads/photo%2Fa/complete")
      data = { state: "pending" };
    else if (req.url === "/api/v1/uploads/info")
      data = {
        brideName: "Meera",
        groomName: "Kabir",
        remaining: 1,
        maxBytes: 10485760,
        configured: true,
      };
    res.end(JSON.stringify({ data }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  port = address.port;
  const previous = api.defaults.baseURL;
  api.defaults.baseURL = "http://127.0.0.1:" + port + "/api/v1";
  t.after(async () => {
    api.defaults.baseURL = previous;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await getPhotos("approved", 2);
  assert.equal(
    requests.at(-1)!.url,
    "/api/v1/weddings/current/photos?state=approved&page=2",
  );
  await moderatePhoto("photo/a", "approve", 7);
  assert.equal(requests.at(-1)!.method, "PATCH");
  assert.equal(requests.at(-1)!.csrf, "photo-csrf");
  assert.deepEqual(requests.at(-1)!.body, { action: "approve", version: 7 });
  await createUploadLink({ days: 7, limit: 100 });
  assert.equal(requests.at(-1)!.csrf, "photo-csrf");
  await revokeUploadLink("grant/a");
  assert.equal(
    requests.at(-1)!.url,
    "/api/v1/weddings/current/upload-links/grant%2Fa",
  );
  assert.equal(requests.at(-1)!.method, "DELETE");
  assert.equal(requests.at(-1)!.csrf, "photo-csrf");
  await getPublicPhotos("wedding/a", 3);
  assert.equal(
    requests.at(-1)!.url,
    "/api/v1/public/weddings/wedding%2Fa/photos?page=3",
  );
  assert.equal(requests.at(-1)!.csrf, undefined);
  await getUploadInfo("public-wedding", "secret-upload-capability");
  assert.equal(requests.at(-1)!.url, "/api/v1/uploads/info");
  assert.deepEqual(requests.at(-1)!.body, {
    publicId: "public-wedding",
    token: "secret-upload-capability",
  });
  assert.equal(requests.at(-1)!.csrf, undefined);
  const file = new File(["image bytes"], "wedding.jpg", { type: "image/jpeg" });
  const upload = await authorizeUpload(
    "public-wedding",
    "secret-upload-capability",
    file,
  );
  assert.deepEqual(requests.at(-1)!.body, {
    publicId: "public-wedding",
    token: "secret-upload-capability",
    name: "wedding.jpg",
    type: "image/jpeg",
    size: file.size,
  });
  const renewed = await renewUpload(
    "public-wedding",
    "secret-upload-capability",
    upload.id,
  );
  assert.equal(renewed.id, upload.id);
  assert.equal(requests.at(-1)!.url, "/api/v1/uploads/photo%2Fa/authorize");
  assert.deepEqual(requests.at(-1)!.body, {
    publicId: "public-wedding",
    token: "secret-upload-capability",
  });
  assert.equal(requests.at(-1)!.csrf, undefined);
  assert.equal(
    requests.filter((request) => request.url === "/api/v1/uploads/authorize")
      .length,
    1,
  );
  // The application client may hold private headers; none belongs on the storage request.
  api.defaults.headers.common["Cookie"] = "session=private";
  api.defaults.headers.common["X-CSRF-Token"] = "private-csrf";
  api.defaults.headers.common["Authorization"] = "Bearer private";
  try {
    await putPhoto(upload, file, () => {});
    const storage = requests.at(-1)!;
    assert.equal(storage.method, "PUT");
    assert.equal(storage.url, "/private-storage?signature=storage-capability");
    assert.equal(storage.type, "image/jpeg");
    assert.equal(storage.cookie, undefined);
    assert.equal(storage.csrf, undefined);
    assert.equal(storage.authorization, undefined);
    assert.equal(storage.body, "image bytes");
  } finally {
    delete api.defaults.headers.common["Cookie"];
    delete api.defaults.headers.common["X-CSRF-Token"];
    delete api.defaults.headers.common["Authorization"];
  }
  assert.deepEqual(
    await completeUpload(
      "public-wedding",
      "secret-upload-capability",
      upload.id,
    ),
    { state: "pending" },
  );
  assert.equal(requests.at(-1)!.url, "/api/v1/uploads/photo%2Fa/complete");
  assert.equal(requests.at(-1)!.csrf, undefined);
  assert.ok(
    requests.every(
      (request) => !request.url.includes("secret-upload-capability"),
    ),
  );
});

const data: Workspace = {
  family: null,
  role: "Worker",
  wedding: {
    brideName: "Meera",
    groomName: "Kabir",
    date: "2027-04-18",
    startTime: "18:00",
    endTime: "23:00",
    venue: "Family Garden",
    address: "Gate 2, Civil Lines",
    city: "Jaipur",
    latitude: null,
    longitude: null,
    contactRole: "Family coordinator",
    phone: "+919999000000",
    welcome: "",
    youtube: "",
    publicId: "test-public-wedding",
    version: 0,
    updatedAt: "2026-11-03T10:00:00Z",
  },
};
const photoPage: PhotoPage = {
  photos: [],
  page: 1,
  pageSize: 24,
  total: 0,
  canModerate: true,
  configured: true,
  grants: [
    {
      id: "private-grant",
      url: "https://example.invalid/upload#private-capability",
      expiresAt: "2027-04-19T00:00:00Z",
      limit: 100,
      used: 0,
      revoked: false,
    },
  ],
};

test("worker photo rendering excludes upload grants and all moderation controls even with a previously privileged response", () => {
  const client = new QueryClient();
  client.setQueryData(["photos", "worker", "approved", 1], photoPage);
  const html = renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(MemoryRouter, null, h(PhotosPage, { userId: "worker", data })),
    ),
  );
  client.clear();
  assert.ok(html.includes("Approved gallery"));
  for (const privateText of [
    "Awaiting review",
    "Create upload link",
    "Guest upload links",
    "private-capability",
    "Approve</button>",
    "Reject</button>",
  ])
    assert.ok(!html.includes(privateText), privateText);
});
test("empty public galleries add no placeholder; approved photos retain download URLs", () => {
  const client = new QueryClient();
  const key = ["public-photos", "test-public-wedding", 1];
  client.setQueryData(key, { photos: [], page: 1, total: 0, pageSize: 24 });
  const render = () =>
    renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client },
        h(PublicGallery, { publicId: "test-public-wedding" }),
      ),
    );
  assert.equal(render(), "");
  client.setQueryData(key, {
    photos: [
      {
        id: "approved-photo",
        name: "wedding.jpg",
        width: 800,
        height: 600,
        url: "/api/v1/public/photo/view",
        downloadUrl: "/api/v1/public/photo/download",
      },
    ],
    page: 1,
    total: 1,
    pageSize: 24,
  });
  const html = render();
  assert.ok(html.includes('id="guest-gallery"'));
  assert.ok(html.includes('href="/api/v1/public/photo/download"'));
  assert.ok(html.includes('src="/api/v1/public/photo/view"'));
  client.clear();
});
