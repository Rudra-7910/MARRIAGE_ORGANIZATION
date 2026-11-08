import { expect, test } from "@playwright/test";

test("organizer setup, real budget, invitation, guest page and restricted worker access", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const password = "Disposable-Browser-Password-2026";
  await page.goto("/signup");
  await page.getByLabel("Your name", { exact: true }).fill("Rudra QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("organizer@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/setup/);
  await page
    .getByLabel("Family name", { exact: true })
    .fill("Sharma & Verma families");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page.getByLabel("Bride’s name", { exact: true }).fill("Meera");
  await page.getByLabel("Groom’s name", { exact: true }).fill("Kabir");
  await page.getByLabel("Wedding date", { exact: true }).fill("2027-12-18");
  await page.getByLabel(/Ceremony \/ shubh muhurat time/).fill("19:00");
  await page.getByLabel("Venue name", { exact: true }).fill("Family Garden");
  await page
    .getByLabel("Full venue address", { exact: true })
    .fill("Gate 2, Civil Lines");
  await page
    .getByLabel("City & state", { exact: true })
    .fill("Jaipur, Rajasthan");
  await page
    .getByLabel("Organizer contact role", { exact: true })
    .fill("Family coordinator");
  await page.getByLabel("Contact phone", { exact: true }).fill("+919999000000");
  await page
    .getByRole("button", { name: "Create wedding", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/overview/);
  await expect(
    page.getByRole("heading", { name: "Your wedding overview" }),
  ).toBeVisible();
  const guestUrl = await page
    .getByRole("link", { name: "Preview guest website", exact: true })
    .getAttribute("href");
  await page.goto("/app/budget");
  await page.getByRole("button", { name: "Set budget", exact: true }).click();
  await page.getByLabel("Wedding budget (₹)", { exact: true }).fill("500000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page
    .getByLabel("Service or expense name", { exact: true })
    .fill("Family caterer");
  await page.getByLabel("Agreed cost (₹)", { exact: true }).fill("120000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Family caterer expense" })
    .click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Amount paid (₹)", { exact: true }).fill("25000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Payment recorded" }),
  ).toBeVisible();
  await page.goto("/app/overview");
  await expect(
    page.getByRole("region", { name: "Private spending summary" }),
  ).toContainText("₹25,000");
  await expect(
    page.getByRole("region", { name: "Private spending summary" }),
  ).toContainText("₹95,000");
  await page.goto("/app/guests");
  await page
    .getByRole("button", { name: "Add guest / family", exact: true })
    .click();
  await page
    .getByLabel("Guest / family name", { exact: true })
    .fill("Gupta Parivar");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("gupta@example.com");
  await page
    .getByRole("button", { name: "Save guest / family", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Prepare invitation", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Wedding invitation email preview"]')
      .getByText("Meera & Kabir", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Send invitation now", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send invitation now", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/members");
  await page
    .getByRole("combobox", { name: "Wedding role", exact: true })
    .selectOption("Worker");
  await page
    .getByRole("button", { name: "Create invitation link", exact: true })
    .click();
  const invite = await page
    .getByLabel("Private invitation link", { exact: true })
    .inputValue();
  const workerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
  });
  const worker = await workerContext.newPage();
  await worker.goto(invite);
  await worker
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await worker.getByLabel("Your name", { exact: true }).fill("Family helper");
  await worker
    .getByLabel("Email address", { exact: true })
    .fill("helper@example.com");
  await worker.getByLabel("Password", { exact: true }).fill(password);
  await worker.getByLabel("Confirm password", { exact: true }).fill(password);
  await worker
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await worker
    .getByRole("button", { name: "Accept & join as Worker", exact: true })
    .click();
  await expect(worker).toHaveURL(/\/app\/overview/);
  await expect(
    worker.getByRole("link", { name: "Budget & Expenses" }),
  ).toHaveCount(0);
  await expect(
    worker.getByRole("region", { name: "Private spending summary" }),
  ).toHaveCount(0);
  const forbidden = await worker.request.get(
    "/api/v1/weddings/current/budget/summary",
  );
  expect(forbidden.status()).toBe(403);
  await worker.goto("/app/budget");
  await expect(worker).toHaveURL(/\/app\/overview/);
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guest = await guestContext.newPage();
  await guest.goto("http://127.0.0.1:4173" + guestUrl);
  await expect(
    guest.getByRole("heading", { name: /Meera.*Kabir/ }).first(),
  ).toBeVisible();
  await expect(
    guest.getByText("18 December 2027", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    guest.getByRole("link", { name: /Google Maps/ }).first(),
  ).toBeVisible();
  expect(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await guest.screenshot({
    path: "test-results/guest-mobile.png",
    fullPage: true,
  });
  await page.goto("/app/overview");
  await expect(
    page.getByRole("heading", { name: "Your wedding overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Private spending summary" }),
  ).toContainText("₹25,000");
  await page.screenshot({
    path: "test-results/organizer-overview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await workerContext.close();
  await guestContext.close();

  // Existing cookies must redirect even after a full page reload on auth URLs.
  for (const route of ["/login", "/signup", "/forgot-password"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/app\/overview$/);
    await expect(
      page.getByRole("heading", { name: "Your wedding overview" }),
    ).toBeVisible();
  }

  // Wait for the server on entry instead of flashing the login form.
  let releaseSessionCheck = () => {};
  const sessionCheck = new Promise<void>((resolve) => {
    releaseSessionCheck = resolve;
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await sessionCheck;
    await route.continue();
  });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Checking your session…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toHaveCount(0);
  releaseSessionCheck();
  await expect(page).toHaveURL(/\/app\/overview$/);
  await page.unroute("**/api/v1/auth/me");
  await expect(
    page.getByRole("heading", { name: "Your wedding overview" }),
  ).toBeVisible();

  // Simulate a cookie expiring in another tab while the user is cached in React.
  await page
    .getByRole("link", { name: "Make My Marriage home", exact: true })
    .click();
  await page.context().clearCookies();
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();

  // Login/sign-up navigation must keep the original allowed private destination.
  await page.goto("/app/budget?view=active#expenses");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("organizer@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/budget\?view=active#expenses$/);
  await expect(
    page.getByRole("heading", { name: "Budget & expenses", exact: true }),
  ).toBeVisible();
});

test("password recovery shows the generic response and handles incomplete links", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("unknown-recovery@example.com");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "If an account matches that email",
  );
  await page.goto("/reset-password#invalid");
  await expect(page.getByRole("alert")).toContainText("Open the complete link");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(
    page.getByRole("link", { name: "Request a new link", exact: true }),
  ).toBeVisible();
});

test("session service errors show a retry state instead of a login form or private page", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { message: "Session storage is temporarily unavailable." },
      },
    }),
  );
  for (const url of ["/login", "/app/budget"]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Couldn’t check your session" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Budget & expenses", exact: true }),
    ).toHaveCount(0);
  }
  await page.unroute("**/api/v1/auth/me");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
