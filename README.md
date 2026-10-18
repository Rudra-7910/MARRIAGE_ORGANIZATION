# Make My Marriage

Wedding organizer SaaS built as a TypeScript modular monolith. This milestone implements only the Express server foundation. Product requirements and planned APIs live in `docs/`.

Project location: `/home/rudra/Desktop/AI_MAKE_MY_MARRIAGE`.

## Run the server

Use Node.js 22.13+ (22 LTS) or Node.js 24 LTS. Dependencies are installed through npm workspaces from the project root.

```bash
cd /home/rudra/Desktop/AI_MAKE_MY_MARRIAGE
npm run dev
```

The development server listens at `http://127.0.0.1:3000`. It restarts when server source files change.

If another process occupies port 3000, run `PORT=3002 npm run dev` and use `http://127.0.0.1:3002` instead. The initial verified run of this backend uses 3002 because an earlier Vite setup still occupies 3000. The configured default remains 3000.

| Endpoint | Purpose |
| --- | --- |
| `GET /` | API name and version |
| `GET /api/v1/health/live` | Confirms the HTTP process is running |
| `GET /api/v1/health/ready` | Returns 200 only when MongoDB is connected; otherwise 503 |

Atlas is optional for this local foundation. To connect it, copy `server/.env.example` to `server/.env` and set your own `MONGODB_URI`. Never commit that file. A failed development connection leaves HTTP available and readiness unavailable. Production startup requires a successful database connection.

## Structure

```text
docs/                         PRD, API design, system design
web/                          Reserved Vite/React workspace; not implemented
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

`npm run check` runs type checking, HTTP checks, and compilation together. `npm start` runs compiled server code; build first and stop the development server if using the same port. These commands target only the backend. Set `NODE_ENV=production` for a later production runtime; AWS deployment is not configured in this milestone.

TypeScript uses Node's ESM conventions: source imports end in `.js` so compiled files run directly in Node. Source code remains ordinary TypeScript functions.

## Scope and design review

The foundation follows the selected Express/Mongoose modular monolith and the API document's `/api/v1` prefix. The older system design uses `/api/...` examples; future endpoints should follow the API document's versioned prefix. The PRD also retains an older assumption excluding email invitations, while its guest requirements and the latest decisions include them. No requirement documents were changed in this milestone.

Session authentication with MongoDB storage, wedding membership authorization, email campaigns, Socket.IO, R2 uploads, and the React UI are planned but not implemented here. There is no temporary in-memory authentication setup. Session-store library, background runner, and precise AWS services remain decisions for their respective milestones.

The server currently includes Helmet headers, bounded JSON parsing, generated request IDs, consistent JSON errors, environment validation, database readiness reporting, and shutdown cleanup. This is a development foundation, not a complete production application.
