# Make My Marriage

A wedding planning application for Indian families. Organizers coordinate departments, track expenses and send invitations. Guests open a wedding website for ceremony details, directions, updates and approved photos without creating an account.

## Stack

- React, Vite and TypeScript; React Router, TanStack Query, Axios and React Hook Form with Zod.
- Express and Mongoose, with MongoDB Atlas for application records and sessions.
- Express sessions, CSRF protection and wedding-scoped role checks.
- Resend for individual email invitations, AWS S3 for private photo storage and Socket.IO for workspace updates.
- Optional Google Places and Hindi label translation; YouTube for ceremony streams.

This is a modular monolith in one repository. In production, Express serves both the API and the built frontend.

## Run locally

Use Node.js 22.13+ or 24 LTS. Install dependencies from the repository root:

```sh
npm ci
```

For a new checkout, copy `server/.env.example` to `server/.env`. Keep an existing `.env` file and its credentials. Configure these values before starting:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string; allow this machine’s IP in Atlas. |
| `SESSION_SECRET` | A random secret of at least 32 characters. |
| `APP_ORIGIN` | `http://127.0.0.1:3000` locally; the exact HTTPS origin in production. |
| `TRUST_PROXY_CIDRS` | Leave empty locally. In production, list only the trusted proxy IPs or subnets. |

```sh
npm run dev
```

Open **http://127.0.0.1:3000**. Express listens on port 3001; Vite proxies `/api` to it. Express starts only after MongoDB and its required indexes are ready. `npm run dev:web` and `npm run dev:server` run the processes separately.

## Application flow

**Account → family → wedding → dashboard.** A service provider can create a directory profile without registering a wedding.

- Authenticated account pages check the server session on entry. Signed-in visitors to login/signup return to their workspace. An expired session sends a private-page visitor to login, then back to the requested page. Team-invitation continuation takes priority.
- Wedding details come from one MongoDB record. Organizers edit the date, ceremony time, venue, contact, welcome and YouTube link using the same form used at setup. Other focused pages refresh within 30 seconds; the guest URL stays the same.
- Functions, departments, checklists and attention requests use saved planning data. Progress updates record who changed them and when. Version checks reject stale edits with HTTP 409.
- Budget tracks agreed costs, paid amounts and pending dues in integer paise. Payment request keys prevent duplicate recordings; voided payments retain their audit history.
- Guests are grouped by family and bride/groom side. Personal invitation links show the functions shared with that family. The public website shows the main wedding and functions marked public. No RSVP is required.
- Guest photo uploads use private S3 storage and organizer review. Only approved photos appear in the public gallery.
- Provider listings, reviews and contact details are persisted. Arrangements and payments are agreed directly with providers; the app does not book them.

The organizer overview and guest website display the saved ceremony date, venue and an IST countdown. Hindi invitation text is editable. Homepage examples are marked as samples and never send emails.

## Wedding roles

| Role | Access |
| --- | --- |
| Creator / Admin | Manage the wedding and invite all roles. Only the creator can remove other Admins or Organizers. |
| Organizer | Edit wedding details, manage expenses, photos and guest invitations; invite/remove Managers and Workers. |
| Manager | Manage permitted department work; invite Workers and remove Workers they invited. No budget or guest-record access. |
| Worker | Update assigned work and view department progress. No budget, guest records or team invitations. |

Roles are checked against the wedding in MongoDB on private requests. Hiding a navigation item does not grant or revoke API access.

Team links use `/team-invites#<token>`. They expire after seven days, are single-use and are not bound to an email address. The server stores only token hashes. Acceptance requires a signed-in account and uses the role saved in the invitation. Each account can belong to one wedding.

## Email and photo configuration

For email invitations, set `RESEND_API_KEY` and `RESEND_FROM` in `server/.env`, then restart Express. Use a sender on a verified domain. Localhost guest links work only on your computer; real invitations need the deployed HTTPS `APP_ORIGIN`.

Open **Guests & Invites → Add guest / family → Prepare invitation**. Preview the email before choosing **Send invitation now**. V1 sends one family at a time. Scheduling, bulk campaigns, automatic reminders and queues are deferred to V2.

`Submitted` means the email provider accepted the request; inbox delivery is not tracked. A timeout can leave an `Unconfirmed` result. Check the provider before retrying: retries reuse the saved content and idempotency key, even after wedding edits. The guest website continues to show current details.

For photos, set `AWS_REGION` and `S3_BUCKET` in the backend environment. Locally, select a restricted AWS CLI profile with `AWS_PROFILE`. On Vercel, configure OIDC access through `AWS_ROLE_ARN`; on AWS hosting, attach a restricted workload role. Keep credentials server-side and out of source control.

Keep the S3 bucket private with Block Public Access enabled and ACLs disabled. Grant the backend only `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` on its `staging/*` and `review/*` objects. Configure bucket CORS for the frontend origin with `PUT`, `GET` and `HEAD`, allowing `Content-Type` and `x-amz-*` headers. The explicit maintenance command `npm run media:cleanup --workspace server` retries tracked cleanup; it is not scheduled automatically. Optional integration placeholders are listed in `server/.env.example`.

## Code structure

```text
web/src/
  app/                 Routes and lazy loading
  pages/               Homepage, login, signup and recovery
  features/
    auth/              Session guard and shared account-page content
    weddings/          Setup, dashboard, planning, budget, guests and settings
    media/             Guest upload and public gallery
    providers/         Provider profiles and reviews
    integrations/      Place search, language switch and live updates
  components/          Shared layout, brand, icons and dialogs
  lib/                 Axios requests, types and shared formatters
  styles/              Theme tokens and page styles
server/src/
  app.ts               API registration and production frontend serving
  main.ts              Startup and shutdown
  config/              Environment, MongoDB, storage, logging and realtime
  middleware/          HTTP errors and wedding access checks
  modules/             Auth, weddings, planning, finance, invitations,
                       media, providers, site and integrations
  scripts/             Production configuration and media cleanup commands
```

To follow a request, start with a page’s TanStack Query query/mutation, then its Axios call in `web/src/lib`, then the matching Express route. Small handlers use Mongoose directly. Shared forms, permission rules, serialization and send/concurrency safeguards stay shared where consistency matters.

Keep new code in the same style: ordinary `async/await`, explicit conditions and direct Mongoose calls in routes. Use Zod, React Hook Form and the existing SDKs for standard work. Extract a helper when it contains a shared rule or a substantial operation; avoid wrappers that only rename a single library call. Keep validation, guest-safe response fields, authorization, transactions and version checks in place when simplifying.

## Check and build

```sh
npm run check
```

`check` runs both TypeScript checks, backend/frontend tests and production builds. Tests use disposable MongoDB instances and stub email providers, not Atlas or real mail. The MongoDB binary downloads on the first test run. GitHub CI also audits production dependencies and builds the Docker image.

After building, `npm start` serves the app through Express. Deployment requires infrastructure configuration, including the exact HTTPS origin, trusted proxy settings and storage access. Current rate limits are per process; use a shared limiter before running multiple instances.

The application is also deployed on [Vercel](https://make-my-marriage-mocha.vercel.app). `vercel.json` builds both workspaces and routes API requests through `api/server.mjs`. Configure production variables from `server/.env.production.example`; adjust the CSP origin and S3 endpoint for your own deployment.

The repository includes sanitized environment examples. Real environment files, credentials, generated files, `docs/`, `e2e/` and `playwright.config.ts` stay on the developer's machine and are ignored by Git. Do not add real secrets to the example files. Ignoring a file does not remove earlier commits containing it.

## Local-only material

Additional design notes, deployment guides and end-to-end tests are maintained locally. The `test:e2e`, `test:production` and `test:vercel` scripts remain available for that local tooling and require the excluded files. They are not run by GitHub CI.

Public design rules are in [design.md](design.md).
