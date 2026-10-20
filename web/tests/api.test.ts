import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { api, getCurrentUser, login, logout, signup } from "../src/lib/api";

test("Axios auth client sends JSON and CSRF headers and preserves server errors", async (t) => {
  const user = { id: "test-user", name: "API Test", email: "api@example.com" };
  const requests: {
    path: string;
    method: string;
    token: string | undefined;
    body: unknown;
  }[] = [];
  let meStatus = 200;
  let csrfStatus = 200;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    requests.push({
      path: req.url!,
      method: req.method!,
      token: req.headers["x-csrf-token"] as string | undefined,
      body: body ? JSON.parse(body) : null,
    });
    res.setHeader("Content-Type", "application/json");
    if (req.url?.endsWith("/csrf")) {
      res.statusCode = csrfStatus;
      res.end(
        JSON.stringify(
          csrfStatus === 200
            ? { data: { token: "test-csrf-token" } }
            : { error: { message: "Session unavailable." } },
        ),
      );
    } else if (req.url?.endsWith("/me") && meStatus !== 200) {
      res.statusCode = meStatus;
      res.end(
        JSON.stringify({
          error: {
            message:
              meStatus === 401 ? "Please log in." : "Database unavailable.",
          },
        }),
      );
    } else {
      res.end(
        JSON.stringify({ data: req.url?.endsWith("/logout") ? null : user }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  const originalBase = api.defaults.baseURL;
  api.defaults.baseURL = `http://127.0.0.1:${address.port}/api/v1`;
  t.after(async () => {
    api.defaults.baseURL = originalBase;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  assert.equal(api.defaults.withCredentials, true);
  assert.equal(api.defaults.timeout, 15000);
  await t.test(
    "signup, login and logout each retrieve CSRF before their POST",
    async () => {
      assert.deepEqual(
        await signup({
          name: user.name,
          email: user.email,
          password: "Test-Password",
        }),
        user,
      );
      assert.deepEqual(
        await login({ email: user.email, password: "Test-Password" }),
        user,
      );
      await logout();
      assert.deepEqual(
        requests.map((item) => item.method + " " + item.path),
        [
          "GET /api/v1/auth/csrf",
          "POST /api/v1/auth/signup",
          "GET /api/v1/auth/csrf",
          "POST /api/v1/auth/login",
          "GET /api/v1/auth/csrf",
          "POST /api/v1/auth/logout",
        ],
      );
      for (const request of requests.filter((item) => item.method === "POST"))
        assert.equal(request.token, "test-csrf-token");
      assert.deepEqual(requests[1].body, {
        name: user.name,
        email: user.email,
        password: "Test-Password",
      });
    },
  );
  await t.test("current user returns null only for 401", async () => {
    assert.deepEqual(await getCurrentUser(), user);
    meStatus = 401;
    assert.equal(await getCurrentUser(), null);
    meStatus = 503;
    await assert.rejects(getCurrentUser(), /Database unavailable/);
  });
  await t.test(
    "CSRF failures prevent the POST and keep the useful error message",
    async () => {
      csrfStatus = 503;
      const before = requests.length;
      await assert.rejects(
        login({ email: user.email, password: "Test-Password" }),
        /Session unavailable/,
      );
      assert.equal(requests.length, before + 1);
      assert.equal(requests.at(-1)?.method, "GET");
    },
  );
});
