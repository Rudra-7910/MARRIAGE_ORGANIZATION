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
- Changes immediately appear in the editing organizer’s view through query-cache updates. Other focused guest/workspace pages refresh within 30 seconds and on focus; polling pauses in hidden tabs. Guest URLs remain stable after edits.
- Guests & Invites saves real guest/family entries in MongoDB, with bride/groom/both grouping, search, pagination and version-checked edits. Only this wedding’s organizers can access these records.
- Prepare a personal email for one saved family at a time. The live server-rendered preview includes saved wedding details, Google Maps directions, contact, optional YouTube link and the public wedding website. No guest login or RSVP.
- Send immediately through Resend, with persisted `Submitting`, `Submitted`, `Failed` and `Unconfirmed` results. Concurrent requests atomically claim one send. Safe retries reuse the exact saved email and provider idempotency key.

The approved Stitch A/B/C Celebration Review designs now guide the homepage, organizer overview and public guest website. The original dashboard sidebar and all section routes remain behind the wedding-creation gate. Wedding identity, ceremony details, guest link, access and invitation metrics use API data. The organizer overview reuses the paginated guest query rather than requesting every guest or fetching each row individually. Unconnected features have explicit coming-next states instead of fake spending or task progress.

The homepage has keyboard-accessible product-preview tabs, a local invitation-note preview and FAQ accordions. Its sample family and celebration photographs are illustrative; it never sends email. Organizer and public guest pages use decorative invitation artwork rather than displaying a sample couple/venue as the current user’s photograph. Approved Stitch photography is served as local WebP assets with responsive sizes; below-the-fold photos are lazy loaded. A YouTube player loads only after the guest chooses to open it. Restrained marigold/blush accents and hover/focus feedback carry across the redesigned pages.

Both real wedding pages put the saved wedding date, AM/PM ceremony time with IST, and venue prominently in the wedding hero. A compact **Shubh muhurat** countdown inside that hero shows days, hours, minutes and seconds until the ceremony; it never displays the current time or an analog clock. It reads the saved wedding date and ceremony start time explicitly as IST (`+05:30`), updates locally each second and pauses its timer while hidden. The countdown performs no network requests and never shows negative time or claims a ceremony is live after its start. Digit motion respects reduced-motion preferences. The invitation artwork, Hindi welcome and other sections remain in place. The wedding form explains that organizers should enter their family-agreed auspicious time; the app does not calculate astrology. Editing those saved fields updates the countdown through the normal workspace/public data flow.

New invitation drafts include `॥ श्री गणेशाय नमः ॥` and a respectful Hindi family invitation. The personal note stays editable, and a saved custom public welcome overrides the default Hindi blessing. Previously attempted emails retain their exact frozen payload for idempotent retries; a design/copy change never rewrites an earlier attempt.

Nearby service categories use the saved venue/address or coordinates to open a Google Maps search. Category photographs are decorative illustrations from Stitch, not actual vendor listings or wedding photos. The in-app directory has not been connected yet.

The old sample records, localStorage wedding drafts and demo upload routes have been removed. Old `/demo/*` bookmarks route through the real authenticated flow. No wedding records are seeded for new users.

Expense tracking, a vendor directory, photo uploads and additional functions have frontend sections but no backend persistence yet. Their action buttons are disabled and marked coming soon. Earlier product documents describe planned work; the implemented invitation and team flows below take precedence for current V1.

## Wedding roles and team invitations

Open **People & Access → choose role → Create invitation link → Copy invitation link**. Team links are shared manually, separately from guest invitation emails. Invitees log in/sign up, then explicitly accept without registering another family/wedding or verifying email.

- Creator: protected wedding Admin; can invite all four roles and remove other Admins/Organizers. Existing creators stored as Organizer receive Admin capabilities without a database migration.
- Other Admins/Organizers: edit wedding details, manage guest invitations, access finance, invite/remove Managers and Workers.
- Manager: invite Workers and remove only Workers they invited. No finance or guest-record access. Department-level work/assignment is still planned.
- Worker: no team invitations, finance or guest-record access. Budget is absent from navigation, overview links and direct page access for both Workers and Managers.

Links are single-use bearer capabilities: anyone holding one can claim it after signing in, so share privately. They expire after seven days and are not email-address-bound. Each account belongs to one wedding; a link cannot replace an existing role. Remove and re-invite when a member’s role needs to change.

URLs use `/team-invites#<random-token>`. Only a SHA-256 hash of the 256-bit token persists. Preview/accept send tokens in JSON bodies, keeping them out of API URLs and referrer headers. Login/signup preserve continuation in router history state, not redirect query parameters. Acceptance requires session + CSRF, reads the saved role and inviter’s current authority, and atomically consumes the invite while adding membership to the same wedding document. Version checks and the unique member-user index prevent conflicting joins and replay. Removing an inviter also revokes their outstanding links. Same-account acceptance retries are idempotent while the original membership remains.

Team responses exclude token hashes/raw links; Managers/Workers do not receive others’ email addresses. Full links appear only at creation and can be revoked. Limits: 500 invitation records per wedding, 50 creations/hour/IP, 40 previews/minute/IP. In-process rate limits need a shared store before running multiple Express instances.

Budget currently returns availability metadata only (`available:false`) to Admins/Organizers; Workers/Managers receive 403, including budget subpaths. Expense storage remains unimplemented. Membership is re-read from MongoDB for every private request rather than trusting a role in the session. Removal blocks subsequent private API requests; open workspaces refresh membership within 30 seconds/on focus. Socket-based access invalidation is not implemented yet.

## Email invitations

Set these placeholders in the gitignored `server/.env`, then restart Express:

```dotenv
RESEND_API_KEY=
RESEND_FROM=
```

`RESEND_FROM` is a sender on your verified domain, for example `Your Wedding <invitations@your-domain.com>`. Resend’s test sender restricts recipients; configure a verified sender before inviting real families. Keep the API key server-side. `APP_ORIGIN` builds the guest website link; localhost links work only on your own computer, so use the deployed HTTPS origin for real invitations.

Open **Guests & Invites → Add guest / family → Prepare invitation**. Review the recipient, subject, note and preview, then choose **Send invitation now**. Missing credentials leave saving/preview available and disable sending; there is no mock-success mode.

V1 sends one accepted invitation per guest/family entry. Duplicate email addresses are allowed for families sharing an inbox; each entry is a separate send, so review your list. Editing a definitely rejected invitation clears that draft so corrected details can be prepared. Submitted or uncertain invitations cannot change recipient/content. A saved retry uses the original sender, recipient and content, even if the wedding is edited later. The linked website continues to show current wedding details.

`Submitted` means Resend accepted the request, not that the email reached the inbox. No delivery webhook/open tracking is implemented. A timeout or server error is `Unconfirmed`, including abandoned sends after a 60-second lease. Check Resend before retrying. Uncertain sends can reuse their key for up to 23 hours; beyond that they are blocked for manual investigation, rather than sent again with a new key. Resend documents a 24-hour idempotency retention window. Scheduling, bulk campaigns, automatic retries/reminders and BullMQ are deferred to V2.

Resend references: [sending API](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Structure

```text
web/src/
  app/App.tsx                  Public/account routes and lazy loading
  pages/HomePage.tsx           Homepage sections in display order
  pages/LoginPage.tsx          Login validation, form state and submission
  pages/SignupPage.tsx         Signup validation, form state and submission
  features/auth/               Account gate and shared login/signup story
  features/weddings/
    SetupPage.tsx              Family setup, wedding setup and flow diagram
    WeddingForm.tsx            Shared create/edit form
    WeddingApp.tsx             Protected workspace routes and organizer edits
    DashboardLayout.tsx        Stitch sidebar, header and responsive navigation
    WeddingOverview.tsx        Dashboard using saved wedding details
    PeoplePage.tsx             Wedding members and shareable role invitations
    TeamInvitePage.tsx         Public invite preview and signed-in acceptance
    WorkspacePages.tsx         Planning sections and guest website settings
    ServicesPage.tsx           Nearby categories and Google Maps discovery
    GuestWeddingPage.tsx       Public guest website
    WeddingCountdown.tsx      Shared local IST countdown, with visibility cleanup
    InvitationsPage.tsx        Saved guest directory and per-family email composer
  lib/api.ts                   Axios client, auth, shared CSRF and error messages
  lib/weddings.ts              Wedding API calls and frontend types
  lib/invitations.ts           Axios guest/preview/send/retry calls
  styles/                      Shared theme, login and wedding UI
    celebration.css           Scoped A/B/C homepage, overview and guest design
server/src/
  app.ts                       Route registration, request IDs and 404 handling
  modules/auth/
    auth.routes.ts            Auth validation, routes and handlers together
    auth.session.ts           Shared session and CSRF configuration
    user.model.ts             User schema and password hashing
  modules/weddings/
    wedding.models.ts          Family and Wedding models
    wedding.routes.ts          Setup, dashboard, edits and public projection
    team.routes.ts             Role invites, atomic acceptance and membership access
    wedding.test.ts            Isolated end-to-end API and RBAC checks
  modules/invitations/
    invitation.model.ts        Wedding-scoped guests and saved email attempts
    invitation.routes.ts       Guest edits, preview, send claims and safe retry
    invitation.email.ts        Escaped email template and Resend HTTP transport
    invitation.test.ts         Isolated MongoDB and stub-provider integration tests
  config/                      Environment, MongoDB connection and indexes
  middleware/error-handler.ts  Shared HTTP error helper and error responses
```

Small route handlers use Mongoose directly. Page-specific form logic stays with its page; genuinely shared pieces such as the wedding form, brand, icons and Axios client remain separate. No extra service/repository layer or global React context is required.

Wedding route handlers show their database queries directly. `workspaceData` only formats the shared response; it performs no I/O. Create/edit responses reuse returned Mongoose documents, with membership/version conditions and unique indexes retained. Team membership guards, guest-safe field selection, invitation leases and retry/idempotency rules remain shared where consistency matters. Team member lookup uses a map rather than repeatedly scanning the user list.

Frontend endpoint functions use explicit Axios requests and return `response.data.data`. All writes use one `getCsrfHeaders` helper from `lib/api.ts`; it fetches a fresh token for the current session. Common API error messages also live there. Setup-only header/diagram markup stays in `SetupPage`; the shared login/signup story lives directly at `features/auth/LoginStory.tsx`. Stateful form/editor boundaries remain separate where keys and hooks protect unsaved input.

Only active source folders are kept. Future feature modules, integrations, jobs and realtime folders will be created when their implementation starts.

## Verification

```bash
npm run check
```

Runs type checks, backend/API and Axios client tests, and both builds. Integration tests use disposable MongoDB instances, never Atlas; their MongoDB binary downloads on first use. Email tests inject a stub provider and never send actual emails. Tests cover setup, ownership, public-field filtering, role enforcement, stale/concurrent edits and sends, CSRF, session/proxy behavior, provider failures and uncertain retry recovery.

`npm start` runs compiled Express after building. Serving the frontend bundle through Express and AWS deployment remain future work. Current IP rate limits are per-process; shared limiting is needed before multiple server instances.

See [the setup/API flow diagram](docs/Wedding-Setup-Flow.md) and [Stitch design reference](docs/designs/stitch-reference.md).
