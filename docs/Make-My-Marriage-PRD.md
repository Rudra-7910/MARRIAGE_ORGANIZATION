# Make My Marriage — Product Requirements Document

Version: 1.4 · Updated: 29 October 2026 · Status: Product baseline with incremental implementation

## 1. Product summary

Make My Marriage is an organizer-first web application for Indian weddings. It combines a private wedding coordination workspace, a wedding-services discovery directory, and a simple guest website.

Its primary job is to reduce repeated calls and manual follow-up: organizers should see service progress, outstanding decisions, deadlines, contacts, and private expenditure in one place. Guests should be able to access relevant wedding information without registering or completing forms.

This document records the product scope. Account/family/wedding setup, the dashboard gate, public wedding details and basic manual email invitations are implemented. Other sections remain planned. Development tests do not send invitations to real recipients; production deployment remains a separate step.

## 2. Goals and boundaries

**Implemented team access amendment (29 October 2026):** People & Access now supports Admin, Organizer, Manager and Worker membership through manually shared single-use links. Creator is the protected Admin and alone grants/removes Admins/Organizers. Other Admins/Organizers manage Managers/Workers; Managers invite Workers and remove only their own invitees. Links expire after seven days and are bearer capabilities rather than email-bound invitations. Login/signup plus explicit acceptance is required; email verification and a new family/wedding are not. Role comes from MongoDB, never a recipient-supplied field. Atomic acceptance consumes the link and grants membership together. Existing membership is never silently replaced. Budget/guest navigation and API access are unavailable to Managers/Workers. Budget storage, department assignment and socket revocation remain planned. This amendment resolves the pending token-policy and creator-control questions elsewhere in this document.

### Goals

- Give both families a shared view of wedding preparations.
- Let departments coordinate by viewing each other's progress.
- Surface requests and stale or overdue work under Needs Your Attention.
- Support family-managed departments, providers discovered in the directory, and vendors hired elsewhere. Hiring arrangements happen outside the app.
- Provide automated email invitations and effortless guest access.
- Keep finances private to organizers and photo publication subject to approval.
- Keep the mobile interface authored in English, with optional Hindi translation using Google Cloud Translation API rather than a separately authored Hindi version.

### Out of scope

- Multiple-wedding organizer dashboards or concurrent provider engagements.
- Accommodation, transport coordination, seating plans, or admission enforcement.
- RSVP forms or attendance-response buttons.
- Mandatory individual task ownership.
- Guest payments, payment processing, accounting, or gift tracking.
- In-app booking, availability reservations, chat, bidding, contracts, or dispute resolution.
- Custom livestream infrastructure or invitation design editor.
- Dress guidance, ceremony instructions, or required items for guests.
- Microservices, seat locking, or complex recommendation systems.

## 3. Explicit assumptions awaiting confirmation

These defaults allow planning to proceed; they are not represented as confirmed user decisions.

| ID | Assumption | Impact |
|---|---|---|
| A1 | Only the wedding creator can add or remove fellow organizers. | Creator is a distinguished owner within the organizer role. |
| A2 | A provider can participate in one active wedding workspace at a time, joining another after completion or removal. | Workspace scope only; no booking or control over outside engagements. |
| A3 | The three reminders are organizer attention-summary emails, scheduled 7, 4, and 1 calendar days before the main wedding date. | No automated guest reminder campaign. Guest email invitations remain excluded. |
| A4 | Other organizers have the same wedding-finance access as the creator. | “Main organizers” means the organizer role; no additional finance role. |
| A5 | Removed: no booking workflow in V1. | Families can manage the wedding directly; the directory supports discovery and contact. |
| A6 | Mongoose and Express session authentication are selected. Background processing execution remains to be confirmed. | Sessions persist in MongoDB; no Better Auth or JWT refresh-token flow. |

## 4. Users and authorization

Any family member can sign up and manage the wedding independently. Professional hiring is optional.

Roles are scoped to a wedding, not inferred solely from a global account role. A public provider profile does not grant access to a wedding.

| Capability | Creator | Organizer | Department manager | Worker/helper | Guest |
|---|---|---|---|---|---|
| Manage organizer membership | Yes | No | No | No | No |
| Manage wedding/functions | Yes | Yes | No | No | No |
| Appoint/remove managers | Yes | Yes | No | No | No |
| Manage department workers | Yes | Yes | Own department | No | No |
| View cross-department progress | Yes | Yes | Yes | Yes | No |
| Update work | All | All | Own department | Own department | No |
| Raise attention request | Yes | Yes | Own department | Own department | No |
| Resolve attention request | Yes | Yes | No | No | No |
| View/edit wedding finances | Yes | Yes | No | No | No |
| Manage invitations/announcements | Yes | Yes | No | No | No |
| Approve gallery photos | Yes | Yes | No | No | No |

Workers see relevant work details and a cross-department progress summary, not private finance, guest records, or unrelated internal notes. An organizer may explicitly invite a provider as a department manager; adding directory details alone grants no access. Linked workers have limited access. Outside vendors require no account.

Membership removal must revoke API and Socket.IO access. Authenticated users lacking permission receive 403; unauthenticated private requests receive 401. Guests use limited invitation/upload access, not staff sessions.

## 5. Functional requirements

### FR1 — Wedding setup and functions

- A family member, couple member, or planner can sign up and immediately create a wedding without email verification.
- Collaborators can accept valid membership invitations while signed in without email verification; exact token acceptance policy remains to be confirmed.
- Record couple names, photographs, main wedding date, timezone, venues, and organizer contacts.
- Support one wedding workspace per organizer in V1, with multiple organizers per wedding.
- Both families edit the shared workspace. Use bride/groom labels and distinct colors; labels remain visible independently of color.
- Functions have editable names, start/end times, venue, and applicable invitation groups.
- Validate function timing and prevent overlapping scheduled functions within the wedding.
- Show role and phone number for approved guest-facing contacts; names/photos are not required for these contacts.

### FR2 — Checklist and department work

- Seed an editable checklist including venue, photography, catering, decoration, and lighting. Every item is removable; the template is not a mandate.
- Work items belong to departments or groups. Individual assignment is optional, never required.
- Status is To do (red), In progress (yellow), or Done (green), with text labels.
- Support optional deadlines and work notes.
- Record each meaningful progress update with author, timestamp, and whether it was entered on behalf of a service.
- Organizers can mark work complete based on a vendor's phone or in-person confirmation.
- A service card shows contact action, progress, last update, next deadline, and appropriate notes. Finance fields appear only for organizers.
- Done work may be reopened, preserving its history.

### FR3 — Needs Your Attention

- A department can raise a flag with a short explanation while retaining its existing work status.
- Organizers can resolve flags; retain who resolved them and when.
- Automatically surface unfinished overdue work and services with no meaningful progress update for six days by default.
- Permit the organizer to change the stale-update interval.
- Measure services with no updates from their addition to the wedding. Viewing a page or editing a contact does not reset the progress timer.
- Completed work is excluded from stale/overdue checks. Completion does not silently resolve an unrelated manual flag.
- Group related reasons on a service's attention card to avoid duplicate clutter.
- Show attention items immediately in the dashboard; email scheduling does not delay their visibility.

### FR4 — Scheduled organizer summaries

- Under A3, evaluate unresolved attention items 7, 4, and 1 calendar days before the main wedding date, at 09:00 in the wedding timezone; default timezone Asia/Kolkata.
- Send at most one consolidated summary per organizer per scheduled checkpoint, only when unresolved items exist.
- Do not send daily summaries or backfill missed checkpoints when a wedding is created late.
- Track logical notification IDs and delivery outcomes to prevent duplicate processing; retries are attempts to deliver the same summary, not new reminders.
- If the date changes, cancel future obsolete jobs and reschedule unsent checkpoints. Do not repeat checkpoints already sent automatically.
- Email addresses are required for organizer accounts under this assumption; guest email addresses are not required.

### FR5 — Services directory and family-managed departments

- Any family member can independently sign up, create a wedding, and manage its departments. A hired planner, engineer, or provider is never required.
- Departments can be managed entirely by family members without linked provider profiles.
- Providers register category, description, portfolio, service area, contact information, and stated availability.
- Organizers select a location using Google Places and search our registered providers using latitude/longitude and MongoDB geospatial queries. Keep location labels for readability; GeoJSON coordinates use longitude, latitude order.
- Organizers sort by rating or newest, inspect profiles, and contact providers.
- Availability is informational; the app does not reserve slots or confirm hiring.
- Organizers can add discovered provider details to their wedding service records. All hiring arrangements occur outside the app.
- No booking requests, acceptance/confirmation states, or booking locks exist.
- Access is granted separately through an explicit wedding membership invitation. Apply A2 to workspace participation only.
- Proposed review rule: one organizer review per completed wedding service linked to a registered provider. Reviews are not labeled verified bookings or purchases.
- Providers cannot edit received reviews. Minimal platform-admin moderation can hide abusive profiles/reviews.

### FR6 — Outside vendors

- Organizers can record service category, vendor contact, notes, progress, and agreed amounts without registering the vendor.
- Authorized staff maintain these records on the vendor's behalf.
- An outside-vendor entry does not automatically create a public marketplace listing or review eligibility.

### FR7 — Budget and expenses

- Store optional overall budget, agreed service amounts, dated payments, and notes.
- Calculate total agreed cost, total paid, and remaining balances; clearly distinguish actual paid spending from commitments.
- Record nonnegative currency amounts with consistent precision; default currency INR.
- No funds move through the application. Payments are manually recorded facts.
- Exclude finance fields from unauthorized API responses and socket events, not only from the UI.

### FR8 — Guests and email invitations

- This wedding’s Organizers maintain individual/family entries with name, email and Bride/Groom/Both side; search, filtering, pagination and edits use real persisted data. Workers and Managers cannot access the guest directory or send invitations in current V1.
- One family entry can represent multiple people. No admission count or restrictions; no guest account, RSVP or mandatory attendance response.
- Organizer opens one saved family, edits the email subject and plain-text personal note, reviews the live preview, then chooses **Send invitation now**.
- The server automatically includes real couple names, ceremony date/time in IST, venue/address, Google Maps directions from saved coordinates/address, contact role/phone, optional YouTube link and `/w/:publicId` guest website.
- Resend is selected. Its API key and verified-domain sender are configured server-side. Without them, saving/preview work and sending is blocked with a clear explanation.
- Save the exact email before the provider request. Statuses: Not sent, Submitting, Submitted, Failed and Unconfirmed. Submitted means accepted by Resend, not delivered to an inbox. No delivery/open tracking in current V1.
- Concurrent sends are deduplicated per guest using an atomic version claim and provider idempotency key. Failed/uncertain outcomes have a deliberate safe retry where possible. Unknown attempts outside the provider's safe key window are blocked for investigation rather than blindly resent.
- One submitted invitation per family entry in V1. Rejected entries can be corrected; submitted/uncertain content is locked so retries preserve the same payload. Updating the wedding updates the linked website; it does not rewrite previously sent email.
- The public wedding link exposes public wedding information only; no private guest database. Guest-specific ceremony grants/revocation, invitation image uploads and campaign controls are not implemented by this increment.
- V2: bulk campaigns, queues/BullMQ, scheduling, automated retries/reminders and delivery webhooks. WhatsApp delivery is excluded from current V1.

### FR9 — Guest website and announcements

- Display couple information, invited functions, venue details, and organizer-published updates.
- Directions open a mapping service from the guest's current location; do not promise a guaranteed fastest route.
- Support entrance/parking details, landmarks, and hall names without implementing transport management.
- Provide tap-to-call role-based contacts.
- Internal service progress and attention flags never publish automatically. Organizers write guest announcements separately.
- Require no guest account for viewing.

### FR10 — Photos and livestream

- A wedding QR code opens a simple photo-selection/upload page without registration or required uploader name.
- Pending photos are stored privately for review; they are not public merely because their gallery entry is hidden.
- Only organizers approve or reject submissions. Approved photos are publicly viewable and downloadable; reject actions prevent publication and initiate removal of rejected media.
- Use image type/size limits, upload rate limits, and revocable upload links to reduce misuse.
- Organizers can unpublish approved photos. Downloaded copies cannot be recalled.
- Exact upload limits, retention duration, and storage budget are deployment configuration decisions.
- Use YouTube Live only. An organizer pastes the livestream URL and the guest page embeds its player with scheduled time and an Open in YouTube fallback. Broadcasting is managed on YouTube; optionally retain the recording link. No other streaming integration or custom broadcast pipeline.

## 6. Primary screens

1. Sign-in and wedding setup.
2. Organizer dashboard: Needs Your Attention, department progress, next functions, private spending summary.
3. Department/service detail: work, updates, deadlines, contacts, notes.
4. People and roles: organizers, managers, workers.
5. Functions and guest announcements.
6. Guests and email invitation campaigns.
7. Private budget and payment records.
8. Services directory, provider detail, and direct contact.
9. Provider/worker workspace scoped to one active wedding.
10. Photo moderation.
11. Guest invitation page, public gallery, upload page, and livestream view.

## 7. Technical design baseline

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | Vite + React, React Router, Tailwind CSS |
| Forms | React Hook Form and Zod |
| Server state | TanStack Query |
| Backend | Node.js and Express; Express serves the built React application and API |
| Database | MongoDB Atlas with Mongoose |
| Authentication | express-session with secure HTTP-only cookies and MongoDB session storage; no email verification in V1, including collaborator acceptance |
| Live updates | Socket.IO |
| Background work | MongoDB-backed jobs proposed for simplicity; execution arrangement pending confirmation |
| Scheduling | Scheduled background checks and reminder dispatch |
| Media | Cloudflare R2; pending submissions private, approved photos publicly accessible |
| Translation | Google Cloud Translation API for optional Hindi |
| Livestream | YouTube Live embedded player |
| Architecture | One repository, modular monolith, shared worker code |
| Hosting | AWS confirmed; deployment will be learned and implemented incrementally alongside the project. Individual services and topology remain to be selected. |
| Invitation email | Resend; immediate per-family Express request, no queue in current V1 |
| Location | Google Places for selection; MongoDB geospatial queries for nearby registered providers |

Use feature-based Express routers and handlers, extracting service functions where useful. Avoid unnecessary controller/repository layers and Context-based state architectures. Use ordinary React hooks and TanStack Query for server state.

Keep basic backend field, status, amount, and permission checks. Frontend Zod validation does not replace server checks; a shared-schema framework is not required.

### Live update flow

REST mutation → authorization and validation → database commit → Socket.IO event → scoped client query invalidation.

Authenticate socket connections using the session and authorize wedding-room subscriptions. Broadcast minimal change identifiers; clients fetch only data their role permits. Re-fetch after reconnect to recover missed events.

Socket.IO broadcasts authorized progress changes and notifications. No booking, availability, or seat locks are required.

### Language behavior

Author the interface in English. A Hindi toggle requests translations of display text through the backend using Google Cloud Translation API. Cache reusable translations and fall back to English if translation fails. Keep credentials server-side. Do not translate names, phone numbers, URLs, or stored source records, or automatically submit private notes, budgets, or guest lists for translation. No separate Hindi content set or human-reviewed Hindi is required in V1.

### Background delivery flow

Persist delivery intent → enqueue job → worker calls messaging provider → save outcome → process delivery callback.

Use job identifiers, bounded retries, persisted job claims/outcomes, and failed-job visibility. External provider calls can have ambiguous outcomes; do not claim exactly-once delivery. Reconcile recorded provider identifiers before retrying where supported.

## 8. Conceptual data model

- User and Session.
- Wedding and WeddingMembership, including role, department scope, and creator marker.
- Function and Venue details.
- Department/WeddingService, linked to a provider or manual vendor.
- WorkItem, ProgressUpdate, AttentionFlag, and Note.
- ProviderProfile and Review; no Booking entity.
- GuestGroup, Invitation, Campaign, and MessageDelivery.
- Expense/PaymentRecord and wedding budget.
- Announcement, PhotoSubmission, and gallery publication state.
- NotificationJob/DeliveryIntent.

Wedding-owned records carry wedding scope. Money uses integer minor units or an appropriate decimal representation, not floating-point arithmetic. Save timestamps consistently and render/schedule using the wedding timezone.

## 9. Quality and acceptance criteria

| Scenario | Acceptance condition |
|---|---|
| Private access | A worker or organizer from another wedding cannot read the target wedding's budget through REST or sockets. |
| Membership removal | Removed users lose private API access and active room subscriptions. |
| Department coordination | A committed update reaches authorized connected clients; reconnecting clients recover current state. |
| Organizer update | Organizer marks vendor work done without a vendor login; actor and timestamp remain visible. |
| Attention request | Manual flag appears without changing the three-state progress model and persists until resolved. |
| Stale updates | Unfinished service becomes stale after the configured interval; completed work is excluded. |
| Reminder cap | Only the three designated checkpoints can generate scheduled summaries; no empty or duplicate logical summaries. |
| Family-managed wedding | A family member can create and manage departments without hiring or booking anyone. |
| Provider access | Adding directory details grants no private access; explicit membership is required. |
| Outside vendor | Organizer adds and manages a vendor without generating an account. |
| Guest access | Invitation opens without registration and exposes only assigned functions. No RSVP is requested. |
| Invitations | Organizer previews and sends one saved family invitation; outcome persists, concurrent sends deduplicate, failed/uncertain results receive safe deliberate retry. Missing keys never produce fake success. |
| Gallery privacy | Pending/rejected assets cannot be retrieved through public gallery URLs; only organizers approve. |
| Public gallery | Approved photos can be viewed/downloaded without login. |
| Finances | Service and wedding totals agree with recorded payments; unauthorized responses omit financial data. |
| Usability | Mobile flows use English source text, optional API-translated Hindi, English fallback, and labels accompanying colors. |
| Livestream | A YouTube Live URL produces an embedded player and an Open in YouTube fallback. |

Automate focused tests around authorization, provider membership scope, reminder scheduling/deduplication, and photo visibility. Manually verify invitation, vendor-update, mobile, and Hindi workflows. Production credentials and real-recipient delivery are separate from development testing.

## 10. Delivery sequence

1. Session authentication, wedding setup, memberships, and functions.
2. Checklist, department progress, attention flags, outside vendors, and Socket.IO updates.
3. Private budget and payments.
4. Guest pages, announcements, email campaign jobs, and organizer reminders.
5. Services directory, direct contact, optional provider membership, and reviews.
6. Photo moderation, public gallery, Google Translate integration, and YouTube Live embed.
7. End-to-end verification and incremental AWS deployment, with guided learning and operational setup.

This sequence does not remove marketplace or media features from V1; it prioritizes the core coordination workflow.

### AWS deployment and learning approach

- AWS is the selected hosting platform for the Express application serving the React production build and API. The developer is new to AWS and will learn it through this project.
- Introduce deployment concepts when needed, with a clear explanation of each component's purpose, request flow, configuration, and running cost before selecting or provisioning it.
- Begin with a small practice deployment, then deploy the application after its core flows are working locally. Do not require completing a broad AWS course before development.
- Learn account access and permissions, budget alerts, application compute, network access, environment variables/secrets, HTTPS/domain setup, logs, process restarts, and deployment updates in manageable steps.
- Prefer a simple initial topology. EC2 is a proposal in the system design, not a finalized AWS service choice. Region, instance size, reverse proxy, process management, DNS/TLS, and monitoring choices will be reviewed before implementation.
- MongoDB remains on MongoDB Atlas and media remains on Cloudflare R2. Choosing AWS hosting does not migrate those services to AWS alternatives.
- Deployment readiness includes working HTTPS/session cookies, Socket.IO connectivity, protected API access, recoverable background jobs under the chosen runtime, useful logs, and a documented restart/update procedure.
- Record the final setup and verification steps in a deployment guide so the developer can explain and repeat the deployment independently. Actual provisioning, paid resources, and production deployment require a later explicit instruction.

## 11. Success measures and dependencies

Evaluate whether organizers can identify unresolved work without inspecting every department, whether vendor progress stays current, and whether the dashboard reduces follow-up calls. Track attention resolution time, update age, invitation delivery failures, and photo-review backlog. Set numeric business targets after a pilot rather than inventing baselines.

Dependencies: transactional email provider and sending-domain configuration, email costs, Cloudflare R2, Google Places and Cloud Translation API configuration, AWS deployment, and an organizer-supplied YouTube Live URL with embedding enabled. Hosting budget and retention policies must be settled before deployment.

References consulted during planning:

- [Express session middleware](https://expressjs.com/en/resources/middleware/session/) — selected session authentication approach.
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — direct upload access for selected media storage.
