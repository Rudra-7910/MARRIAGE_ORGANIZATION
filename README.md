# Make My Marriage

Wedding organizer SaaS built as a TypeScript modular monolith. The current milestone includes the responsive React homepage, login UI, and the existing Express server foundation. Product requirements and planned APIs live in `docs/`.

Project location: `/home/rudra/Desktop/AI_MAKE_MY_MARRIAGE`.

## Run the homepage

Use Node.js 22.13+ (22 LTS) or Node.js 24 LTS. Dependencies are installed through npm workspaces from the project root.

```bash
cd /home/rudra/Desktop/AI_MAKE_MY_MARRIAGE
npm run dev
```

The Vite homepage opens at `http://127.0.0.1:3000` with hot reload. The homepage runs independently of Express and Atlas. Vite uses a strict port: it reports an error if 3000 is occupied instead of silently switching ports.

Implemented: the Stitch-inspired homepage, responsive navigation, illustrative workspace preview with note disclosures and department filtering, features, setup steps, FAQ disclosures, a footer, and the `/login` UI. Homepage login navigation opens that route. The login form uses React Hook Form and Zod for required-field/email checks, supports password visibility and password-manager autofill, and explicitly states that sign-in is not connected. Submitting valid fields shows a preview message; it never sends, logs, or persists credentials or claims a successful login.

Workspace creation and signup still show a clear coming-soon dialog. Privacy, terms, and contact controls indicate that those details will be provided before launch. No signup form, session authentication, dashboard, external integrations, Hindi translation, or business APIs are implemented in this milestone. All displayed wedding names and financial figures are illustrative.

## Run the backend separately

```bash
PORT=3001 npm run dev:server
```

The explicit port keeps the backend separate from Vite. The existing backend default remains 3000 if no `PORT` is set. Both processes can run in separate terminals; the homepage currently does not need API access.

| Endpoint | Purpose |
| --- | --- |
| `GET /` | API name and version |
| `GET /api/v1/health/live` | Confirms the HTTP process is running |
| `GET /api/v1/health/ready` | Returns 200 only when MongoDB is connected; otherwise 503 |

Atlas is optional for this local foundation. To connect it, copy `server/.env.example` to `server/.env` and set your own `MONGODB_URI`. Never commit that file. A failed development connection leaves HTTP available and readiness unavailable. Production startup requires a successful database connection.

## Structure

```text
docs/                         PRD, API design, system design
web/
  index.html                  Page title, description, fonts and favicon
  vite.config.ts              React/Tailwind plugins and port 3000
  src/
    main.tsx                  React entry point
    app/App.tsx               Application root
    pages/HomePage.tsx        Homepage sections and dialog state
    pages/LoginPage.tsx       Login layout and supporting navigation
    components/layout/        Site header and footer
    components/ui/            Brand, icons and information dialog
    features/home/
      components/             Preview, comparison, features, steps, FAQs
      data/home-content.ts    Homepage copy and illustrative content
    features/auth/
      components/             Login form and supporting story panel
      login-schema.ts         Client-side login field validation
    styles/index.css          Tailwind theme and responsive component styles
    styles/login.css          Responsive login page styles
server/
  .env.example                Documented local configuration
  src/
    main.ts                   HTTP startup and graceful shutdown
    app.ts                    Express middleware and route registration
    config/                   Environment and Mongoose connection
    routes/                   Versioned API router
    middleware/               Request IDs, JSON errors, 404 handling
    modules/
      health/                 Implemented health routes and HTTP checks
      auth/                   Future account/session endpoints
      weddings/               Future wedding setup
      memberships/            Future organizer/manager/worker access
      functions/              Future ceremonies and venues
      departments/            Future checklist and service progress
      attention/              Future attention flags
      finance/                Future organizer-only expenses
      providers/              Future provider directory
      invitations/            Future guests and email invitations
      media/                  Future uploads and approved gallery
      announcements/          Future guest updates
      translation/            Future Hindi interface support
    integrations/             Reserved email, Google, and R2 adapters
    realtime/                 Reserved Socket.IO setup
    jobs/                     Reserved reminder/background processing
```

Future feature code stays inside its module: route/controller, service, and Mongoose model files can be added when that feature is implemented. Empty folders are placeholders, not working services. There are no mandatory repository classes or dependency injection containers.

## Verification and compiled startup

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm run check` runs type checking for both workspaces, the backend HTTP checks, and both production builds. `npm start` runs compiled backend code only; build first and choose a free port. To inspect the frontend production build locally, run `npm run preview --workspace web`. Serving the React production build through Express and AWS deployment remain future work. Set `NODE_ENV=production` for a later backend production runtime.

The backend uses Node's ESM conventions: source imports end in `.js` so compiled files run directly in Node. The frontend uses Vite's bundler resolution. Both use ordinary TypeScript functions.

## Scope and design review

The foundation follows the selected Express/Mongoose modular monolith and the API document's `/api/v1` prefix. The older system design uses `/api/...` examples; future endpoints should follow the API document's versioned prefix. The PRD also retains an older assumption excluding email invitations, while its guest requirements and the latest decisions include them. No requirement documents were changed in this milestone.

Session authentication with MongoDB storage, wedding membership authorization, email campaigns, Socket.IO, R2 uploads, and application screens beyond the homepage and login UI are planned but not implemented here. There is no temporary in-memory authentication setup. Session-store library, background runner, and precise AWS services remain decisions for their respective milestones.

The server currently includes Helmet headers, bounded JSON parsing, generated request IDs, consistent JSON errors, environment validation, database readiness reporting, and shutdown cleanup. This is a development foundation, not a complete production application.
