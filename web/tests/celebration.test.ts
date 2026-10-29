import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { test } from "node:test";
import { HomePage } from "../src/pages/HomePage";
import { GuestWeddingPage } from "../src/features/weddings/GuestWeddingPage";
import { WeddingOverview } from "../src/features/weddings/WeddingOverview";
import { WeddingCountdown } from "../src/features/weddings/WeddingCountdown";
import { weddingCountdown, weddingDate, weddingTime } from "../src/lib/weddings";
import type { Workspace, WeddingRecord } from "../src/lib/weddings";
import type { GuestList } from "../src/lib/invitations";

test("the shubh muhurat countdown uses IST, including for guests abroad", () => {
  const now = Date.parse("2027-02-13T12:29:55Z");
  assert.deepEqual(weddingCountdown("2027-02-14", "18:00", now), {
    days: 1,
    hours: 0,
    minutes: 0,
    seconds: 5,
    started: false,
  });
  assert.deepEqual(
    weddingCountdown("2027-02-14", "00:15", Date.parse("2027-02-13T18:44:59Z")),
    {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
      started: false,
    },
  );
  assert.equal(
    weddingCountdown("2027-02-14", "18:00", Date.parse("2027-02-14T12:30:00Z"))!
      .started,
    true,
  );
  assert.equal(
    weddingCountdown("2027-02-14", "18:00", Date.parse("2028-02-14T12:30:00Z"))!
      .days,
    0,
  );
  assert.equal(weddingCountdown("bad-date", "25:00", now), null);
  assert.equal(
    weddingCountdown("2027-02-14", "18:00", Date.parse("2027-02-14T12:29:59.500Z"))!.seconds,
    1,
  );
  assert.equal(weddingDate("2027-02-14"), "14 February 2027");
  assert.equal(weddingTime("18:00"), "6:00 PM");
  assert.equal(weddingTime("00:15"), "12:15 AM");
  assert.equal(weddingTime("12:30"), "12:30 PM");
  const oldTimezone = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(weddingCountdown("2027-02-14", "18:00", now)!.seconds, 5);
    assert.equal(weddingDate("2027-02-14"), "14 February 2027");
  } finally {
    if (oldTimezone) process.env.TZ = oldTimezone;
    else delete process.env.TZ;
  }
});

test("a completed countdown is a blessing, never a negative timer or a fake live state", () => {
  const html = renderToStaticMarkup(
    h(WeddingCountdown, { date: "2000-01-01", time: "18:00" }),
  );
  assert.ok(html.includes("शुभ मुहूर्त आ गया है"));
  assert.ok(!html.includes('role="timer"'));
  assert.ok(!html.includes("Live now"));
});

test("a wedding fifteen days away shows a countdown, never the current time or an analog clock", (t) => {
  const now = Date.parse("2027-01-30T12:30:00Z");
  t.mock.method(Date, "now", () => now);
  const html = renderToStaticMarkup(
    h(WeddingCountdown, {
      date: "2027-02-14",
      time: "18:00",
      detailsHref: "#ceremony",
    }),
  );
  assert.ok(html.includes("15 days, 0 hours, 0 minutes, 0 seconds until the wedding"));
  assert.ok(html.includes('href="#ceremony"'));
  assert.ok(!html.includes("CURRENT TIME"));
  assert.ok(!html.includes("wedding-clock-dial"));
  assert.ok(html.includes('aria-live="off"'));
  assert.deepEqual(weddingCountdown("2027-02-14", "18:00", now + 1000), {
    days: 14, hours: 23, minutes: 59, seconds: 59, started: false,
  });
  const updated = renderToStaticMarkup(
    h(WeddingCountdown, { date: "2027-02-15", time: "18:00" }),
  );
  assert.ok(updated.includes("16 days, 0 hours, 0 minutes, 0 seconds until the wedding"));
});

const wedding: WeddingRecord = {
  publicId: "isolated-render-wedding",
  brideName: "Meera <script>bad()</script>",
  groomName: "Kabir",
  date: "2027-02-14",
  startTime: "18:00",
  endTime: "23:30",
  venue: "Family Garden",
  address: "Gate 3, Green Road",
  city: "Lucknow",
  latitude: 26.85,
  longitude: 80.95,
  contactRole: "Bride’s family coordinator",
  phone: "+91 (99999) 00000",
  welcome: "",
  youtube: "",
  version: 0,
  updatedAt: "2026-10-29T10:00:00Z",
};
function guestHtml(client: QueryClient) {
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(
        MemoryRouter,
        { initialEntries: ["/w/" + wedding.publicId] },
        h(
          Routes,
          null,
          h(Route, { path: "/w/:publicId", element: h(GuestWeddingPage) }),
        ),
      ),
    ),
  );
}

test("the guest website renders only fetched identity, address and contact; updates preserve the public URL", () => {
  const client = new QueryClient();
  client.setQueryData(["guest-wedding", wedding.publicId], wedding);
  let html = guestHtml(client);
  assert.ok(html.includes("Meera &lt;script&gt;bad()&lt;/script&gt;"));
  assert.ok(!html.includes("<script>bad()"));
  assert.ok(html.includes("Family Garden"));
  assert.ok(html.includes("26.85%2C80.95"));
  assert.ok(html.includes('href="tel:+919999900000"'));
  assert.ok(html.includes("श्री गणेशाय नमः"));
  assert.ok(html.includes("आपकी उपस्थिति ही हमारे लिए सबसे सुंदर उपहार है"));
  assert.ok(!html.includes("youtube.com/embed"));
  assert.ok(!html.includes("Organizer login"));
  assert.ok(!html.includes("Royal Palace"));
  assert.match(html, /datetime="2027-02-14"/i);
  assert.ok(html.includes("6:00 PM IST"));
  assert.ok(
    html.indexOf('class="celebration-guest-hero"') <
      html.indexOf('class="wedding-countdown"'),
  );
  assert.ok(
    html.indexOf('class="celebration-guest-date"') <
      html.indexOf('class="wedding-countdown"'),
  );
  const youtube = "https://youtu.be/abcdefghijk";
  client.setQueryData(["guest-wedding", wedding.publicId], {
    ...wedding,
    venue: "Updated Family Hall",
    welcome: "A personal family welcome.",
    youtube,
  });
  html = guestHtml(client);
  assert.ok(html.includes("Updated Family Hall"));
  assert.ok(html.includes("A personal family welcome."));
  assert.ok(html.includes("Load wedding ceremony YouTube player"));
  // YouTube is not embedded until the visitor explicitly loads the player.
  assert.ok(!html.includes("<iframe"));
  assert.ok(html.includes(youtube));
  client.clear();
});

test("organizer totals use the saved guest query; worker rendering never exposes cached guest details", () => {
  const client = new QueryClient();
  const guests: GuestList = {
    guests: [
      {
        id: "family-one",
        name: "Private Test Family",
        email: "private@example.com",
        side: "Both",
        version: 2,
        status: "failed",
        canEdit: true,
        canRetry: true,
        lastAttemptAt: null,
        submittedAt: null,
        error: "Rejected",
      },
    ],
    total: 7,
    page: 1,
    pageSize: 20,
    summary: { total: 7, submitted: 4, notSent: 2, attention: 1 },
    emailConfigured: true,
  };
  client.setQueryData(
    ["guests", "account-one", { page: 1, search: "", side: "All" }],
    guests,
  );
  function render(role: Workspace["role"]) {
    return renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client },
        h(
          MemoryRouter,
          null,
          h(WeddingOverview, {
            userId: "account-one",
            data: {
              family: { id: "family", name: "Our Family", side: "Both" },
              wedding,
              role,
            },
          }),
        ),
      ),
    );
  }
  const organizer = render("Organizer");
  assert.ok(organizer.includes("Private Test Family"));
  assert.ok(organizer.includes("Needs your attention"));
  assert.ok(organizer.includes(">7</strong>"));
  assert.ok(organizer.includes("6:00 PM IST"));
  assert.ok(
    organizer.indexOf('class="celebration-organizer-date"') <
      organizer.indexOf('class="wedding-countdown"'),
  );
  const worker = render("Worker");
  assert.ok(!worker.includes("Private Test Family"));
  assert.ok(!worker.includes("private@example.com"));
  assert.ok(!worker.includes("Prepare invitation"));
  assert.ok(!worker.includes("/app/budget"));
  client.clear();
});

test("homepage interactions are clearly illustrative and lead to real signup rather than fake workspaces", () => {
  const html = renderToStaticMarkup(h(MemoryRouter, null, h(HomePage)));
  assert.ok(html.includes("Shaadi ke pal,"));
  assert.ok(html.includes('role="tablist"'));
  assert.equal((html.match(/role="tab" /g) || []).length, 3);
  assert.equal((html.match(/<details/g) || []).length, 3);
  assert.ok(html.includes("NOTHING IS SENT"));
  assert.ok(html.includes('href="/signup"'));
  assert.ok(!html.includes("/demo/"));
});
