import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
const beforeRoot = (await readFile("/tmp/mmm-simplify-backup-path", "utf8")).trim();
const user = { id: "compare-user", name: "Family member", email: "compare@example.invalid" };
async function render(root, relativePath, name, props, route, setup) {
  const module = await import(pathToFileURL(root + "/web/src/" + relativePath).href);
  const client = new QueryClient();
  if (setup) client.setQueryData(["wedding-setup", user.id], setup);
  const result = renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [route] }, h(module[name], props))));
  client.clear();
  return result;
}
const cases = [
  { label: "signup", path: "pages/SignupPage.tsx", component: "SignupPage", props: {}, route: "/signup" },
  { label: "invited signup", path: "pages/SignupPage.tsx", component: "SignupPage", props: {}, route: { pathname: "/signup", state: { teamInviteToken: "a".repeat(64) } } },
  { label: "login", path: "pages/LoginPage.tsx", component: "LoginPage", props: {}, route: "/login" },
  { label: "family setup", path: "features/weddings/SetupPage.tsx", component: "SetupPage", props: { user }, route: "/app/setup", setup: { family: null, wedding: null, role: null } },
  { label: "wedding setup", path: "features/weddings/SetupPage.tsx", component: "SetupPage", props: { user }, route: "/app/setup", setup: { family: { id: "family", name: "Our family", side: "Both" }, wedding: null, role: null } },
];
for (const item of cases) {
  const previous = await render(beforeRoot, item.path, item.component, item.props, item.route, item.setup);
  const current = await render(process.cwd(), item.path, item.component, item.props, item.route, item.setup);
  assert.equal(current, previous, item.label + " rendered markup changed");
  console.log("Unchanged rendered markup: " + item.label);
}
