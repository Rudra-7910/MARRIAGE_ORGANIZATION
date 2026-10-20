# Make My Marriage

TypeScript wedding organizer application: Vite/React, Express, Mongoose and MongoDB Atlas. The current working flow is **account → family → wedding → dashboard**, with organizer editing and a public guest website using the same MongoDB wedding record.

## Run locally

Use Node.js 22.13+ or 24 LTS. Project: `/home/rudra/Desktop/AI_MAKE_MY_MARRIAGE`.

```bash
npm install
npm run dev
```

Frontend: **http://127.0.0.1:3000**. Express: port 3001. Vite forwards same-origin `/api` requests to Express. `npm run dev:web` and `npm run dev:server` run them individually.

Configure the gitignored `server/.env` before starting. Use `server/.env.example` as a template for a fresh checkout:

- `MONGODB_URI`: your Atlas database connection string.
- `SESSION_SECRET`: at least 32 characters; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `APP_ORIGIN`: default `http://127.0.0.1:3000`. Local development also accepts `localhost` on that protocol/port; production requires the exact origin.
- `TRUST_PROXY_CIDRS`: empty by default. Only set to actual trusted proxy IPs/subnets for TLS termination; restrict backend network access to those proxies. Blanket trust values and `/0` networks are rejected.

Both environments wait for MongoDB and required indexes before listening. Atlas must allow the machine's IP and the database user must be able to create indexes. A runtime disconnection makes readiness/auth unavailable. Keep credentials out of source control.

## What works

- Session-based signup/login/logout through a shared Axios client; bcrypt hashing in the Mongoose save hook, HttpOnly cookies, CSRF/origin protection and authentication rate limits.
- Register your family (name and bride/groom/both side), then create your wedding.
- The blank wedding form collects couple names, date, ceremony start/optional end time, venue/address/city, optional coordinates, public contact role/phone, optional welcome note and YouTube link.
- Dashboard access requires an existing wedding. Direct navigation without one goes to setup. The dashboard API returns a JSON 409 redirect instruction instead of fabricated data.
- Organizer members edit wedding details using the same form. Server-side membership checks reject worker/manager writes, and version checks prevent stale edits from overwriting a newer save.
- `/w/:publicId` is a login-free guest website with the saved names, date, venue, Google Maps directions, public contact and optional YouTube player.
- Changes immediately appear in the organizer view. Open guest pages refresh within five seconds and on focus. Guest URLs remain stable after edits.

The original Stitch dashboard layout and section navigation are retained behind the wedding-creation gate. Overview, Functions, Teams & Services, Budget & Expenses, Guests & Invites, Find Services, Photos, Guest Website, Wedding Settings and People & Access all have dedicated screens. Wedding identity, ceremony details, guest link and current access use API data. Unconnected features have explicit empty/coming-soon states rather than fake vendors, spending or progress.

Nearby service categories use the saved venue/address or coordinates to open a Google Maps search. Category photographs are decorative illustrations from Stitch, not actual vendor listings or wedding photos. The in-app directory has not been connected yet.

The old sample records, localStorage wedding drafts and demo upload routes have been removed. Old `/demo/*` bookmarks route through the real authenticated flow. No wedding records are seeded for new users.

Invitations, expense tracking, a vendor directory, photo uploads, additional functions and team-invitation controls have frontend sections but no backend persistence yet. Their action buttons are disabled and marked coming soon. Earlier product documents describe planned work, not completed services.

## Structure

```text
web/src/
  app/App.tsx                  Public/account routes and lazy loading
  pages/HomePage.tsx           Homepage sections in display order
  pages/LoginPage.tsx          Login validation, form state and submission
  pages/SignupPage.tsx         Signup validation, form state and submission
  features/auth/               Account gate and shared login/signup story
  features/home/data/          Homepage copy and content lists
  features/weddings/
    SetupPage.tsx              Family setup, wedding setup and flow diagram
    WeddingForm.tsx            Shared create/edit form
    WeddingApp.tsx             Protected workspace routes and organizer edits
    DashboardLayout.tsx        Stitch sidebar, header and responsive navigation
    WeddingOverview.tsx        Dashboard using saved wedding details
    WorkspacePages.tsx         Planning sections and guest website settings
    ServicesPage.tsx           Nearby categories and Google Maps discovery
    GuestWeddingPage.tsx       Public guest website
  lib/api.ts                   Axios client and session authentication
  lib/weddings.ts              Wedding API calls and frontend types
  styles/                      Shared theme, login and wedding UI
server/src/
  app.ts                       Route registration, request IDs and 404 handling
  modules/auth/
    auth.routes.ts            Auth validation, routes and handlers together
    auth.session.ts           Shared session and CSRF configuration
    user.model.ts             User schema and password hashing
  modules/weddings/
    wedding.models.ts          Family and Wedding models
    wedding.routes.ts          Setup, dashboard, edits and public projection
    wedding.test.ts            Isolated end-to-end API and RBAC checks
  config/                      Environment, MongoDB connection and indexes
  middleware/error-handler.ts  Shared HTTP error helper and error responses
```

Small route handlers use Mongoose directly. Page-specific form logic stays with its page; genuinely shared pieces such as the wedding form, brand, icons and Axios client remain separate. No extra service/repository layer or global React context is required.

## Verification

```bash
npm run check
```

Runs type checks, backend/API and Axios client tests, and both builds. Integration tests use disposable MongoDB instances, never Atlas; their MongoDB binary downloads on first use. Tests cover setup redirect behavior, ownership, duplicate creation, validation, persisted edits, public-field filtering, role enforcement, stale/concurrent edits, auth, CSRF, origin restrictions, proxy cookies and logout after exhausted quotas.

`npm start` runs compiled Express after building. Serving the frontend bundle through Express and AWS deployment remain future work. Current IP rate limits are per-process; shared limiting is needed before multiple server instances.

See [the setup/API flow diagram](docs/Wedding-Setup-Flow.md) and [Stitch design reference](docs/designs/stitch-reference.md).
