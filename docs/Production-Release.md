# V1 production build and deployment guide

Updated 8 November 2026. One Express process serves built React, the API and Socket.IO. MongoDB stays on Atlas, photos stay in private Amazon S3, and email uses Resend. These files do not create a public deployment or provision paid infrastructure.

## Completed application scope

- Account → family → wedding → dashboard; editing and single-use role invitations.
- Functions, departments, checklist, status/attention flags and organizer on-behalf updates.
- Organizer-only budget, recorded external payments, version conflicts, idempotent payment retries and retained history.
- Individual email invitations, family-specific functions, announcements, guest directions and YouTube embeds.
- Private QR photo upload, processing, organizer approval, approved gallery and explicit cleanup.
- Registered service profiles, nearby directory, completed-service reviews and moderator controls.
- Optional Places selection and common Hindi interface labels.
- Password recovery through the existing Resend SDK: hashed 15-minute single-use tokens, atomic consumption, account/IP throttling and HTTP/socket session invalidation. Signup still needs no email verification.
- Real finance totals and upcoming functions on the overview. Workers get neither the budget section nor its API response.
- Production frontend serving, security headers, safe structured HTTP logs, API rate limits, health checks, configuration checks and a React error boundary.

Queues, scheduled/bulk email, automatic reminders, bookings, a payment gateway and multiple event types remain V2.

## Verify and build

Use the supported Node.js 22.13+ or 24 version:

```sh
npm ci
npm run check
npm run test:production
npx playwright install chromium
npm run test:e2e
```

`check` runs type checks, backend/frontend tests and both builds. The browser test expects those builds, starts its own disposable Mongo replica set and injects a fake email sender. It never uses Atlas or sends real mail. For an existing local Chrome installation: `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e`.

Outputs are `web/dist` and `server/dist`. In production Express serves both. Vite is only used for development/building. Deep browser links refresh correctly; unknown APIs and missing assets return 404 instead of HTML. Hashed assets have immutable caching; HTML is revalidated and API responses are not cached.

Verification on 8 November: 144 backend/frontend tests passed, both browser flows passed, compiled production startup/proxy-cookie smoke passed, and npm audit reported zero known dependency vulnerabilities. The configuration gate accepts a complete test configuration and rejects missing mail settings/reused secrets. Docker is not installed on this development machine, so the image build is provided in CI and remains to be executed there or on a Docker-enabled host. These checks do not replace live AWS/provider verification.

GitHub CI runs the checks, browser test, production dependency audit and Docker build. It does not deploy. Local failure traces/screenshots in gitignored `test-results/` can contain private form details; do not publish them automatically.

## Production configuration

Start with `server/.env.production.example`; preserve your existing local `.env`. Put filled production values outside the repository, for example `/etc/mmm/production.env`, readable only by the deployment operator. Never put secrets in `VITE_*`, Docker build arguments or build artifacts.

| Setting | Before launch |
|---|---|
| `NODE_ENV` | `production`, enabling secure `__Host-` cookies. |
| `APP_ORIGIN` | Exact public HTTPS origin with no trailing slash. All invitation/recovery links use it. |
| `MONGODB_URI` | Production Atlas database/replica set with transactions, required index permissions and restricted network access. |
| `SESSION_SECRET`, `LINK_SECRET` | Different random values, each 32+ characters. Keep the link secret stable. |
| `TRUST_PROXY_CIDRS` | Actual trusted proxy IPs only. Empty trusts none; never use `/0`, `true` or guessed hop counts. |
| Resend settings | Restricted key and verified sender domain. Disable sensitive-link tracking in provider settings. |
| `AWS_REGION`, `S3_BUCKET` | Intended private bucket and its region. |
| `SUPPORT_EMAIL` | Real monitored platform support address. |
| `PRIVACY_POLICY_URL`, `TERMS_URL` | Actual operator's reviewed, published HTTPS policies, including contact and retention details. Footer summaries do not replace full policies. |
| Google keys | Optional; restrict APIs and configure provider quotas/billing alerts. |
| Moderator IDs | Explicit optional platform moderators; wedding Admins have no implicit platform authority. |

Generate each secret independently with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Rotating `LINK_SECRET` invalidates already shared guest/photo links. Keep stable secrets during ordinary updates.

After building, run this read-only configuration/build gate:

```sh
node --env-file=/etc/mmm/production.env server/dist/scripts/check-production.js
```

It checks configuration and build-file presence without contacting cloud providers. PASS does not verify credential validity, policy contents, bucket privacy, sender verification or backup restoration. Complete the live checks too.

## AWS identity and photo storage

Attach a restricted IAM role to the backend compute. The AWS SDK discovers temporary credentials automatically. Omit `AWS_PROFILE`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on AWS. Keep the local `mmm-local` credentials on your development machine.

Allow only GetObject/PutObject/DeleteObject for `staging/*` and `review/*`. Adapt `docs/aws/s3-iam-policy.json` if choosing a different production bucket; it currently references the existing development bucket. Keep Block Public Access on and ACLs disabled.

Add the exact production HTTPS origin to the bucket CORS settings using `docs/aws/s3-cors.json` as the template. Development-only CORS will block browser uploads. The application's CSP also permits the configured regional S3 endpoint. Approved files stay private and are accessed through short-lived signed URLs.

Decide retention/storage budget. The explicit cleanup command handles abandoned/rejected files and never removes approved memories. Configure any maintenance schedule or lifecycle policy separately; the application does not silently enable scheduled deletion.

## Package and run

Docker is optional packaging for the same monolith; it does not select/provision an AWS compute service. The image runs as unprivileged `node`, contains compiled output/production dependencies and excludes `.env`, credentials and tests.

```sh
docker build --tag make-my-marriage:v1 .
```

For a **single Linux host with nginx on that same host**, after preparing the environment file:

```sh
docker run --detach --name make-my-marriage \
  --network host --init --restart unless-stopped \
  --env-file /etc/mmm/production.env --env HOST=127.0.0.1 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --log-driver local make-my-marriage:v1
```

For this exact host-network/nginx arrangement, use `TRUST_PROXY_CIDRS=127.0.0.1/32,::1/128`. Express stays bound to localhost. Bridge networking, managed containers and load balancers require their actual proxy/network boundaries; do not blindly reuse localhost trust settings.

Set up your domain and valid HTTPS certificate. `deploy/nginx.conf.example` provides the proxy/WebSocket configuration; replace domain/certificate paths and run `nginx -t` before reloading. Never expose port 3001 publicly. Restrict administrative and Atlas access to intended hosts.

Without Docker, use `node --env-file=/etc/mmm/production.env server/dist/main.js` under your process supervisor with the same environment/proxy rules. `npm start` uses the current environment; it does not automatically convert a development `.env` into production.

## Launch verification and operations

1. Configure provider/AWS spending alerts and availability monitoring.
2. Monitor `/api/v1/health/live` for process liveness and `/api/v1/health/ready` for initialized MongoDB availability. `/api/v1/health` aliases readiness. The container liveness check does not restart a healthy process for a brief Atlas outage.
3. On the public **HTTPS** domain, use a disposable account/wedding to verify signup, refresh/deep links, secure session cookies and logout. Direct HTTP must not obtain a production cookie.
4. Invite a disposable Worker: no budget menu/page and 403 from both budget endpoints. Removing them must end live access.
5. Record/void test expenses and payments; confirm overview totals. Concurrent stale edits must return a conflict.
6. Deliberately send one invitation to your own address. Verify provider acceptance and inbox delivery separately. Test password recovery, expiry, replay rejection and old-session invalidation.
7. Upload one non-sensitive guest photo through a fresh QR. Verify private pending state, approval/public viewing, unpublishing and rejected-file cleanup. Existing signed GETs can work for up to 60 seconds.
8. Change ceremony details and publish a guest update. Verify personal/public guest views, IST countdown, Google Maps and the explicitly loaded YouTube player.
9. Check mobile navigation, keyboard use, support/policy links, and optional Google features after configuration.
10. Configure Atlas backups for the chosen tier and restore to a separate test database. Define retention, recovery ownership and S3 backup/versioning policy. This build does not claim backups have been provisioned or restored.

Pino logs include request ID, method, URL path, status and duration. They omit query strings, headers, cookies and bodies. Unexpected-error logs include error type and request ID without private payloads. Use request IDs for investigation; never add signed links or guest lists to logs.

Keep the previous tagged image and stable secrets when releasing. Build a new release tag, stop gracefully, start the new image and verify readiness/critical flows. Roll back to the previous image on failure; database restoration is a separate operation. A single instance has a brief restart interruption; no zero-downtime claim is made.

Before multiple Express replicas, add a shared Socket.IO adapter, shared rate limits, distributed image-capacity limits and the correct load-balancer/session arrangement. Respect the documented embedded planning/finance bounds until those records move to separate indexed collections.

References: [Express static serving](https://expressjs.com/en/5x/starter/static-files/), [Helmet CSP](https://helmetjs.github.io/), [Socket.IO reverse proxy](https://socket.io/docs/v4/reverse-proxy/), [AWS SDK credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html), [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
