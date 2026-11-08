import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GuestWeddingPage } from "../src/features/weddings/GuestWeddingPage";

const wedding = {
  publicId: "public-wedding",
  brideName: "Meera",
  groomName: "Kabir",
  date: "2027-04-18",
  startTime: "19:00",
  endTime: "",
  venue: "Family Garden",
  address: "Civil Lines, Gate 2",
  city: "Jaipur",
  latitude: null,
  longitude: null,
  contactRole: "Family coordinator",
  phone: "+919999000000",
  welcome: "",
  youtube: "",
};
const functions = [
  {
    id: "private-function",
    name: "Private family mehendi",
    startsAt: "2027-04-16T17:00",
    endsAt: "2027-04-16T20:00",
    venue: "Family home",
    address: "12 Civil Lines",
    city: "Jaipur",
  },
];
const token = "b".repeat(64);
function render(client: QueryClient, hash: string) {
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client },
      h(
        MemoryRouter,
        { initialEntries: ["/w/public-wedding" + hash] },
        h(
          Routes,
          null,
          h(Route, { path: "/w/:publicId", element: h(GuestWeddingPage) }),
        ),
      ),
    ),
  );
}
test("personal guest page uses only the resolved invitation's function list", () => {
  const client = new QueryClient();
  client.setQueryData(["guest-wedding", wedding.publicId], wedding);
  client.setQueryData(["personal-invitation", wedding.publicId, token], {
    name: "Rao family",
    side: "Groom",
    functions,
    announcements: [],
  });
  client.setQueryData(
    ["public-functions", wedding.publicId],
    [{ ...functions[0], name: "Unrelated public function" }],
  );
  const html = render(client, "#invite=" + token);
  assert.ok(html.includes("Private family mehendi"));
  assert.ok(!html.includes("Unrelated public function"));
  assert.ok(html.includes("Rao family"));
  client.clear();
});
test("a withdrawn invitation hides previously cached private functions after a failed refresh", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["guest-wedding", wedding.publicId], wedding);
  const key = ["personal-invitation", wedding.publicId, token];
  client.setQueryData(key, {
    name: "Rao family",
    side: "Groom",
    functions,
    announcements: [],
  });
  await assert.rejects(
    client.fetchQuery({
      queryKey: key,
      staleTime: 0,
      queryFn: async () => {
        throw new Error("Withdrawn invitation");
      },
    }),
  );
  client.setQueryData(
    ["public-functions", wedding.publicId],
    [{ ...functions[0], name: "Must not fall back to public functions" }],
  );
  const html = render(client, "#invite=" + token);
  assert.ok(html.includes("This personal invitation is unavailable"));
  assert.ok(!html.includes("Private family mehendi"));
  assert.ok(!html.includes("Must not fall back"));
  assert.ok(!html.includes("Rao family"));
  client.clear();
});
