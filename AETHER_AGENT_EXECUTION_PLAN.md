# Aether POS — Agent Execution Plan
> **Last Updated:** March 2026  
> **Purpose:** This file is the single source of truth for agents fixing, building, and extending Aether POS. Work through tickets top to bottom. Each ticket is self-contained with context, files to touch, and a clear done condition.  
> **Do not skip tickets within a wave.** Waves 1 and 2 are hard prerequisites before any real organisation data is stored.

---

## How to Use This File

- Tickets are grouped into **Waves** (ordered by risk and dependency).
- Each ticket has a **Status** field — update it to `DONE` when complete and commit.
- Each ticket lists **Files**, **Action**, and **Done When** so an agent can execute without needing additional context.
- Where a ticket depends on another, the dependency is listed explicitly.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |

---

## Wave 1 — Foundation Hardening
> **Goal:** Eliminate all critical stubs, harden the API layer, and enforce security fundamentals. Nothing goes to production until this wave is done.

---

### TICKET W1-01 — Replace Logger Stub with Pino
**Status:** `[x]`  
**Priority:** CRITICAL  
**Files:**
- `backend/src/utils/logger.ts` ← replace entirely
- `backend/src/index.ts` ← update logger import

**Action:**
1. Install `pino` and `pino-pretty`: `npm install pino pino-pretty`
2. Rewrite `logger.ts` to export a configured pino instance with:
   - Log level driven by `LOG_LEVEL` env var (default: `info`)
   - Pretty-print enabled only when `NODE_ENV !== 'production'`
   - Request-ID field injected via a Fastify `onRequest` hook in `index.ts`
3. Replace all existing `logger.log(...)` / `console.log(...)` calls across the backend with the pino instance.
4. Add `LOG_LEVEL` to `.env.example`.

**Done When:**
- `backend/src/utils/logger.ts` contains no stub/placeholder comments.
- `npm run build` passes with zero TypeScript errors.
- A test request to any route produces a structured JSON log line with `requestId`, `method`, `url`, and `statusCode`.

---

### TICKET W1-02 — Replace Idempotency Utility with Redis-Backed Store
**Status:** `[x]`  
**Priority:** CRITICAL  
**Depends on:** W1-01  
**Files:**
- `backend/src/utils/idempotency.ts` ← replace entirely
- `backend/src/index.ts` ← add Redis client initialisation
- `backend/prisma/schema.prisma` ← optional: add `IdempotencyRecord` model as fallback

**Action:**
1. Install `ioredis`: `npm install ioredis`
2. Create a Redis client singleton in `backend/src/lib/redis.ts` using `REDIS_URL` env var.
3. Rewrite `idempotency.ts` to export two functions:
   - `checkIdempotency(key: string): Promise<{ exists: boolean; result?: unknown }>` — checks Redis for a cached result by key.
   - `saveIdempotency(key: string, result: unknown, ttlSeconds = 86400): Promise<void>` — stores result in Redis with TTL.
4. Wrap all payment processing and sale creation endpoints to check/save idempotency using the `Idempotency-Key` header.
5. Add `REDIS_URL` to `.env.example`.
6. Write a unit test: duplicate request with same key returns cached result without re-executing handler.

**Done When:**
- `backend/src/utils/idempotency.ts` contains no placeholder comments.
- Sending a POST to `/api/payments/process` twice with the same `Idempotency-Key` header returns the same response without double-charging.
- `npm test` passes.

---

### TICKET W1-03 — Implement Email Receipt Delivery
**Status:** `[x]`  
**Priority:** CRITICAL  
**Depends on:** W1-01  
**Files:**
- `backend/src/routes/payments.ts` ← find the email receipt TODO and implement it
- `backend/src/lib/emailService.ts` ← create this file
- `backend/.env.example` ← add SMTP vars

**Action:**
1. Install `nodemailer` and types: `npm install nodemailer @types/nodemailer`
2. Create `backend/src/lib/emailService.ts` with:
   - A `sendReceiptEmail(to: string, receiptId: string, receiptHtml: string): Promise<void>` function.
   - SMTP transport configured from `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` env vars.
   - Retry logic: up to 3 attempts with 2-second backoff.
   - On final failure: log error via pino; persist a `failed_email` record to a `NotificationQueue` table for later replay.
3. In `payments.ts`, replace the TODO email stub with a call to `sendReceiptEmail`.
4. Add `SMTP_*` variables to `.env.example` with commented-out example values.
5. Write an integration test using `nodemailer`'s `createTestAccount()` / Ethereal transport.

**Done When:**
- Completing a sale with a customer email address triggers an email receipt with correct line items, subtotal, tax, and total.
- `npm test` passes including the email integration test.
- The TODO comment in `payments.ts` is gone.

---

### TICKET W1-04 — Add API Versioning (/api/v1/)
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `backend/src/index.ts` ← update route registration
- All route files under `backend/src/routes/` ← update prefix
- `frontend/src/` ← update all API base URLs (search for `/api/`)

**Action:**
1. In `backend/src/index.ts`, prefix all route registrations with `/api/v1` instead of `/api`.
2. Add a compatibility redirect: `GET /api/*` → `301` to `/api/v1/*` with a deprecation warning header.
3. Create a constant `API_BASE = '/api/v1'` in `frontend/src/lib/api.ts` (or equivalent config file) and replace all hard-coded `/api/` strings in the frontend with this constant.
4. Update the health check endpoint to remain at `/health` (no versioning on health).
5. Document the versioning policy in `docs/API_VERSIONING.md`: how breaking changes are handled, how long v1 will be supported.

**Done When:**
- All API calls in the frontend use `/api/v1/` prefix.
- `GET /api/inventory` returns `301` pointing to `/api/v1/inventory`.
- `npm run build` (both frontend and backend) passes.

---

### TICKET W1-05 — Add Global Request Validation Middleware
**Status:** `[x]`  
**Priority:** HIGH  
**Depends on:** W1-04  
**Files:**
- `backend/package.json` ← add zod
- `backend/src/schemas/` ← create this directory with schema files per route group
- `backend/src/routes/*.ts` ← add schema references to each route

**Action:**
1. Install `zod`: `npm install zod`
2. Create `backend/src/schemas/inventory.ts`, `sales.ts`, `payments.ts`, `sync.ts` etc., each exporting Zod schemas for request body, query params, and route params.
3. Add a Fastify schema serialization/validation hook in `index.ts` that rejects requests with `400` when the body doesn't match the declared schema.
4. Replace all permissive `any` type casts in route handlers with the corresponding Zod-inferred types.
5. Enable TypeScript `strict: true` in `backend/tsconfig.json` and fix all resulting type errors.

**Done When:**
- `backend/tsconfig.json` has `"strict": true`.
- `npm run build` produces zero TypeScript errors.
- Sending a malformed body to any route (e.g. `POST /api/v1/sales` with missing required fields) returns `400` with a structured validation error.

---

### TICKET W1-06 — Add Rate Limiting to All Endpoints
**Status:** `[x]`  
**Priority:** HIGH  
**Depends on:** W1-04  
**Files:**
- `backend/src/index.ts` ← register rate limit plugin
- `backend/.env.example` ← add rate limit config vars

**Action:**
1. Install `@fastify/rate-limit`: `npm install @fastify/rate-limit`
2. Register the plugin in `index.ts` with:
   - Global default: 200 requests per minute per IP.
   - Stricter limit on auth endpoints (`/api/v1/auth/*`): 10 requests per minute per IP.
   - Tenant-scoped limit: 1000 requests per minute per `tenantId` (extracted from JWT).
3. Return `429 Too Many Requests` with a `Retry-After` header on limit breach.
4. Add `RATE_LIMIT_GLOBAL`, `RATE_LIMIT_AUTH` env vars.
5. Write a test that verifies the auth endpoint rate limit triggers correctly.

**Done When:**
- Sending 11 rapid POST requests to `/api/v1/auth/login` from the same IP returns `429` on the 11th.
- All other routes respect the 200 req/min global limit.

---

### TICKET W1-07 — Implement TOTP MFA for Admin and Manager Roles
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `backend/src/routes/auth.ts` ← add MFA enroll and verify endpoints
- `backend/prisma/schema.prisma` ← add `mfaSecret` and `mfaEnabled` fields to `User`
- `frontend/src/pages/auth/` ← add MFA setup and verify screens
- `backend/src/middleware/authMiddleware.ts` ← enforce MFA for ADMIN/MANAGER

**Action:**
1. Install `speakeasy` and `qrcode`: `npm install speakeasy qrcode @types/speakeasy @types/qrcode`
2. Add to Prisma `User` model: `mfaSecret String?`, `mfaEnabled Boolean @default(false)`, `mfaRecoveryCodes String[]`.
3. Run `npx prisma migrate dev --name add_mfa_fields`.
4. Add API endpoints:
   - `POST /api/v1/auth/mfa/enroll` — generates a TOTP secret, returns QR code as base64 PNG and plaintext recovery codes.
   - `POST /api/v1/auth/mfa/verify` — accepts a 6-digit TOTP code; marks `mfaEnabled = true` on first verify.
   - `POST /api/v1/auth/mfa/challenge` — called on login after password check for MFA-enabled users; returns a short-lived session token on success.
5. In `authMiddleware.ts`, check: if user has `role === 'ADMIN' || 'MANAGER'` and `mfaEnabled === false`, return `403` with message `MFA enrollment required`.
6. Build a frontend MFA setup flow: QR code display → TOTP input to confirm → show recovery codes.
7. Build a frontend MFA challenge screen shown after password entry for enrolled users.

**Done When:**
- An ADMIN user who has not enrolled MFA cannot access any protected route — receives `403`.
- After enrolling, the ADMIN user must enter a valid TOTP code on each login.
- Recovery codes bypass TOTP and are single-use.
- `npm test` passes.

---

### TICKET W1-08 — Implement Session Timeout and Idle Lock
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `frontend/src/hooks/useIdleTimer.ts` ← create this hook
- `frontend/src/components/IdleLockScreen.tsx` ← create this component
- `frontend/src/App.tsx` ← integrate idle lock
- `backend/src/routes/settings.ts` ← add `idleTimeoutMinutes` to tenant settings

**Action:**
1. Create `useIdleTimer.ts`: tracks last mouse move / keypress / touchstart timestamp; fires a callback when elapsed time exceeds the configured threshold.
2. Create `IdleLockScreen.tsx`: full-screen overlay with a PIN entry field. On correct PIN (fetched from user profile), dismisses the overlay.
3. In `App.tsx`, wrap the authenticated layout with the idle timer hook. Default idle timeout: 10 minutes. If the user is on the checkout screen, extend timeout to 30 minutes.
4. Add `idleTimeoutMinutes: Int @default(10)` to the `TenantSettings` Prisma model; expose it in the settings API and settings UI.
5. JWT tokens must have a maximum lifetime of 8 hours regardless of idle lock; force full re-login after JWT expiry.

**Done When:**
- After the configured idle period, the screen locks and requires PIN entry to continue.
- Idle timeout is configurable per tenant in settings.
- JWT expiry forces full re-login independently of idle lock.

---

### TICKET W1-09 — Implement Frontend Security Event Transport
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `frontend/src/lib/security.ts` ← replace the TODO stub

**Action:**
1. Implement the security event logging function to POST to `POST /api/v1/security/events`.
2. Event payload: `{ type: string; severity: 'low'|'medium'|'high'; context: Record<string, unknown>; timestamp: string }`.
3. Queue events in a local array if the request fails (offline or server error); flush on next successful request.
4. Log the following events automatically:
   - Failed login attempt (event type: `auth.login_failed`).
   - MFA challenge failure (`auth.mfa_failed`).
   - Access denied by capability middleware (`authz.capability_denied`).
   - Idle lock triggered (`session.idle_lock`).
5. Remove all stub/TODO comments from `security.ts`.

**Done When:**
- `frontend/src/lib/security.ts` has no TODO comments.
- All four event types above appear in `GET /api/v1/security/events` after triggering each scenario.
- Events queue and flush correctly when the server is temporarily unreachable.

---

### TICKET W1-10 — Implement Inventory Reservation / Hold Mechanism
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `backend/prisma/schema.prisma` ← add `InventoryHold` model
- `backend/src/routes/sales.ts` ← wrap sale creation in hold → commit flow
- `backend/src/routes/inventory.ts` ← expose hold release endpoint

**Action:**
1. Add `InventoryHold` model to Prisma schema:
   ```prisma
   model InventoryHold {
     id          String   @id @default(cuid())
     productId   String
     tenantId    String
     quantity    Int
     expiresAt   DateTime
     sessionId   String
     createdAt   DateTime @default(now())
   }
   ```
2. Run `npx prisma migrate dev --name add_inventory_hold`.
3. In `sales.ts` sale creation handler:
   - Before creating the sale, check `availableQuantity = stockQuantity - sum(active holds) - sum(committed sales)`.
   - If `availableQuantity < requestedQuantity`, return `409 Conflict`.
   - Create an `InventoryHold` with `expiresAt = now + 15 minutes`.
   - On sale commit success: delete the hold, create the `InventoryTransaction`.
   - On sale failure/timeout: release the hold.
4. Add a background job (using `node-cron`) that deletes expired holds every minute.
5. Write a test: two concurrent requests for the last unit — only one should succeed.

**Done When:**
- Concurrent checkout of the last unit results in one success and one `409`.
- Expired holds are cleaned up automatically.

---

### TICKET W1-11 — Wire Gate Scripts into CI/CD
**Status:** `[x]`  
**Priority:** HIGH  
**Files:**
- `backend/scripts/run-all-gates.js` ← local gate orchestrator (new)
- `backend/scripts/gate-migration-drift.js` (exists)
- `backend/scripts/gate-pre-release-evidence.js` (exists)
- `backend/scripts/gate-post-release-evidence.js` (exists)
- `docs/CI_GATES.md` ← local-only gate docs (new)

**Action:**
1. Implement local gate orchestration (no GitHub Actions/workflows) with `backend/scripts/run-all-gates.js`.
2. Add backend npm scripts: `gate:migrate`, `gate:pre-release`, `gate:post-release`, `gate:all`.
3. Document gate checks and local build flow in `docs/CI_GATES.md`.
4. Enforce local build policy: run gates first, then build images locally via Docker Compose.

**Done When:**
- Introducing a Prisma schema change without a migration causes local `gate:migrate` / `gate:all` to fail.
- All three gate scripts are required local release steps, not advisory.
- Docker images are built locally (no GitHub-hosted build workflow).

---

### TICKET W1-12 — Add EOD Cash Reconciliation Workflow
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/prisma/schema.prisma` ← add `CashSession` model
- `backend/src/routes/cashSessions.ts` ← create this route file
- `backend/src/index.ts` ← register route
- `frontend/src/pages/CashReconciliation.tsx` ← create this page
- `frontend/src/App.tsx` ← add route

**Action:**
1. Add `CashSession` to Prisma schema with fields: `id`, `tenantId`, `terminalId`, `openedAt`, `closedAt?`, `openingFloat`, `declaredCash?`, `systemCash` (calculated), `variance?`, `openedBy`, `closedBy?`, `status (OPEN|CLOSED)`.
2. Run migration.
3. Create route endpoints:
   - `POST /api/v1/cash-sessions/open` — opens a session, records opening float.
   - `POST /api/v1/cash-sessions/:id/close` — records declared cash; calculates variance against system cash (sum of cash tender transactions since session open); marks session CLOSED.
   - `GET /api/v1/cash-sessions` — list sessions with filter by date/terminal.
4. Build `CashReconciliation.tsx` page: open session form, close session form with denomination calculator, variance display (green if zero, red if non-zero).
5. Add to navigation under "Operations".

**Done When:**
- A manager can open a shift, take sales, then close with declared cash and see a variance report.
- Closed sessions appear in the reporting API.

---

## Wave 2 — Self-Hosting & Docker Infrastructure
> **Goal:** Every organisation runs in its own isolated Docker stack on a home server. Provisioning a new org takes under 5 minutes.

---

### TICKET W2-01 — Create Per-Tenant Docker Compose Template
**Status:** `[ ]`  
**Priority:** CRITICAL  
**Files to create:**
- `deploy/template/docker-compose.yml`
- `deploy/template/.env.template`
- `deploy/template/nginx.conf`

**Action:**
Create `deploy/template/docker-compose.yml` with the following services. Use `${ORG_NAME}` and `${TRAEFIK_HOST}` as template variables throughout:

```yaml
# deploy/template/docker-compose.yml
name: aether-${ORG_NAME}

services:
  backend:
    image: aether-backend:latest
    container_name: aether-${ORG_NAME}-backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${ORG_NAME}-api.rule=Host(`${TRAEFIK_HOST}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.${ORG_NAME}-api.tls=true"
      - "traefik.http.routers.${ORG_NAME}-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.${ORG_NAME}-api.loadbalancer.server.port=3000"

  frontend:
    image: aether-frontend:latest
    container_name: aether-${ORG_NAME}-frontend
    restart: unless-stopped
    networks:
      - internal
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${ORG_NAME}-web.rule=Host(`${TRAEFIK_HOST}`)"
      - "traefik.http.routers.${ORG_NAME}-web.tls=true"
      - "traefik.http.routers.${ORG_NAME}-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.${ORG_NAME}-web.loadbalancer.server.port=80"

  postgres:
    image: postgres:16-alpine
    container_name: aether-${ORG_NAME}-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: aether_${ORG_NAME}
      POSTGRES_USER: aether
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - aether_${ORG_NAME}_pgdata:/var/lib/postgresql/data
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aether"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: aether-${ORG_NAME}-redis
    restart: unless-stopped
    volumes:
      - aether_${ORG_NAME}_redis:/data
    networks:
      - internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  aether_${ORG_NAME}_pgdata:
  aether_${ORG_NAME}_redis:

networks:
  internal:
    name: aether-${ORG_NAME}-internal
  traefik-public:
    external: true
```

Create `deploy/template/.env.template` with all required environment variables documented.

**Done When:**
- `deploy/template/docker-compose.yml` is valid (`docker compose config` passes after variable substitution).
- All four services start and pass health checks when launched manually with a test org name.

---

### TICKET W2-02 — Create Traefik Reverse Proxy Stack
**Status:** `[ ]`  
**Priority:** CRITICAL  
**Files to create:**
- `deploy/traefik/docker-compose.yml`
- `deploy/traefik/traefik.yml`
- `deploy/traefik/.env.example`

**Action:**
1. Create `deploy/traefik/docker-compose.yml`:
   - Single `traefik` service using `traefik:v3` image.
   - Mounts `/var/run/docker.sock` (read-only) for Docker label discovery.
   - Mounts `./traefik.yml` as static config.
   - Mounts `./acme.json` for Let's Encrypt certificate storage (`chmod 600`).
   - Exposes ports `80` and `443` on the host.
   - Exposes port `8080` for the Traefik dashboard (restricted to internal network).
   - Connects to the `traefik-public` Docker network (must be created externally: `docker network create traefik-public`).

2. Create `deploy/traefik/traefik.yml` with:
   - HTTP → HTTPS redirect middleware applied globally.
   - Let's Encrypt ACME resolver using HTTP-01 challenge (or DNS-01 if wildcard needed).
   - Dashboard enabled with BasicAuth (password hashed with `htpasswd`).
   - Docker provider enabled with `exposedByDefault: false`.

3. Document in `deploy/traefik/README.md`:
   - How to create the `traefik-public` network.
   - How to generate the `acme.json` file with correct permissions.
   - How to set the dashboard BasicAuth password.
   - Local-network-only alternative using mkcert + static TLS config.

**Done When:**
- `docker compose up -d` in `deploy/traefik/` starts Traefik with no errors.
- The Traefik dashboard is accessible at `traefik.yourdomain.com` (or `localhost:8080` for local).
- HTTP traffic is redirected to HTTPS.

---

### TICKET W2-03 — Create Organisation Provisioning Script
**Status:** `[ ]`  
**Priority:** CRITICAL  
**Depends on:** W2-01, W2-02  
**Files to create:**
- `deploy/scripts/provision-org.sh`
- `deploy/scripts/deprovision-org.sh`

**Action:**
Write `deploy/scripts/provision-org.sh` as a bash script that:
1. Prompts for (or accepts as arguments): `ORG_NAME` (slug, lowercase, hyphens only), `TRAEFIK_HOST` (full domain), `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.
2. Validates `ORG_NAME` matches `^[a-z0-9-]+$`; exits with error if invalid or already exists in `deploy/orgs/`.
3. Creates `deploy/orgs/${ORG_NAME}/` directory.
4. Copies `deploy/template/` into the new directory.
5. Uses `envsubst` to substitute all template variables in `docker-compose.yml` and `.env.template`.
6. Generates a cryptographically random `JWT_SECRET` (64 hex chars via `openssl rand -hex 32`) and `DATABASE_PASSWORD` (32 hex chars).
7. Writes the final `.env` file.
8. Runs `docker compose up -d` in the new org directory.
9. Waits for Postgres health check to pass (polls `docker compose exec postgres pg_isready`).
10. Runs `docker compose exec backend npx prisma migrate deploy`.
11. Runs `docker compose exec backend node scripts/seed-admin.js --email ${ADMIN_EMAIL}` to create the first admin user.
12. Prints the login URL and temporary admin password to the terminal.

Write `deploy/scripts/deprovision-org.sh` that:
1. Prompts for `ORG_NAME` and requires explicit confirmation (`type the org name to confirm`).
2. Runs `docker compose down -v` to stop containers and remove volumes.
3. Deletes `deploy/orgs/${ORG_NAME}/`.
4. Logs the deprovisioning event to `deploy/logs/audit.log`.

**Done When:**
- Running `./provision-org.sh acme-test acme.yourdomain.com admin@acme.com ...` creates a working org in under 5 minutes.
- The provisioned org is accessible at its configured domain.
- `./deprovision-org.sh acme-test` cleanly removes all containers, volumes, and config.

---

### TICKET W2-04 — Create Backup and Restore Scripts
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W2-03  
**Files to create:**
- `deploy/scripts/backup-all.sh`
- `deploy/scripts/backup-org.sh`
- `deploy/scripts/restore-org.sh`
- `deploy/scripts/simulate-restore-drill.sh`

**Action:**
1. **`backup-org.sh <ORG_NAME>`:**
   - Runs `pg_dump` inside the org's Postgres container, outputs to `/backups/${ORG_NAME}/$(date +%Y%m%d_%H%M%S).sql.gz`.
   - Runs `redis-cli BGSAVE` and copies the `dump.rdb` file to the same backup directory.
   - Retains the last 30 backup files; deletes older ones.
   - Returns exit code 1 and logs an error if the dump fails.

2. **`backup-all.sh`:**
   - Iterates over all directories in `deploy/orgs/`.
   - Calls `backup-org.sh` for each.
   - Sends a summary notification (pass/fail per org) to the configured admin email.

3. **`restore-org.sh <ORG_NAME> <backup-file>`:**
   - Stops the org's backend container.
   - Drops and recreates the Postgres database.
   - Restores from the specified `.sql.gz` file.
   - Runs `npx prisma migrate deploy` to ensure schema is current.
   - Restarts the backend container.
   - Logs the restore event to `deploy/logs/audit.log`.

4. **`simulate-restore-drill.sh`:**
   - Picks the most recent backup for each org.
   - Restores to a temporary Docker container (`aether-drill-${ORG_NAME}`).
   - Runs smoke tests: `GET /health`, `GET /api/v1/products` (expect 200).
   - Reports pass/fail.
   - Tears down the temporary container.
   - Exits 0 if all orgs pass; exits 1 if any fail.

5. Add a cron job example to `deploy/README.md`: `0 2 * * * /path/to/backup-all.sh`.

**Done When:**
- `backup-org.sh acme-test` produces a timestamped `.sql.gz` file.
- `restore-org.sh acme-test <file>` restores the database and the backend starts cleanly.
- `simulate-restore-drill.sh` exits 0 after a successful drill.

---

### TICKET W2-05 — Create Organisation Update Script
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W2-03  
**Files to create:**
- `deploy/scripts/update-all.sh`
- `deploy/scripts/update-org.sh`

**Action:**
Write `deploy/scripts/update-org.sh <ORG_NAME>`:
1. Runs `backup-org.sh ${ORG_NAME}` — aborts update if backup fails.
2. Runs all gate scripts: `node backend/scripts/gate-migration-drift.js`, `node backend/scripts/gate-pre-release-evidence.js`. Aborts on failure.
3. Runs `docker compose pull` to pull latest `aether-backend` and `aether-frontend` images.
4. Runs `docker compose up -d --no-deps backend frontend` for a rolling restart.
5. Runs `docker compose exec backend npx prisma migrate deploy`.
6. Polls `GET /health` until 200 (timeout: 60 seconds). Rolls back to previous image tag if health check fails.
7. Runs `node backend/scripts/gate-post-release-evidence.js`.
8. Logs the update to `deploy/logs/updates.log`.

Write `deploy/scripts/update-all.sh`:
- Iterates over all org directories and calls `update-org.sh` for each.
- Stops on first failure by default; `--continue-on-error` flag to proceed.

**Done When:**
- `update-org.sh acme-test` performs a zero-downtime update with pre-backup and health check.
- A failed health check triggers automatic rollback.

---

### TICKET W2-06 — Build Organisation Admin Portal
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W2-03  
**Files to create:**
- `admin-portal/` ← new top-level directory with its own Vite + React app
- `deploy/traefik/` ← add routing for `admin.yourdomain.com`

**Action:**
Build a lightweight React admin portal (separate from the main POS app) running at `admin.yourdomain.com`:

1. **Org list page:** Table of all provisioned orgs (read from `deploy/orgs/` via a local API). Columns: org name, domain, last backup, container health (green/red per service), created date.
2. **Provision form:** Form to provision a new org (calls `provision-org.sh` via a backend API endpoint).
3. **Deprovision action:** Confirmation modal → calls `deprovision-org.sh`.
4. **Per-org settings:** Edit domain, SMTP config, idle timeout; writes to the org's `.env` file and restarts the relevant container.
5. **Health dashboard:** Per-org, per-service container status. Auto-refreshes every 30 seconds.
6. **MFA enforced** on the admin portal login (always, no bypass).
7. The admin portal backend is a small Express or Fastify server that executes the shell scripts via `child_process.exec` and reads Docker status via `docker compose ps --format json`.

**Done When:**
- A new org can be provisioned entirely from the admin portal UI.
- Container health status is visible and updates in real time.
- MFA is required for every login.

---

### TICKET W2-07 — Add Tenant DB Query Isolation
**Status:** `[ ]`  
**Priority:** CRITICAL  
**Files:**
- `backend/src/lib/prismaClient.ts` ← create or update
- `backend/src/middleware/authMiddleware.ts` ← ensure tenantId is on request context

**Action:**
> **Note:** In the per-org Docker model, each org has its own database, so cross-tenant queries via SQL are impossible. However, if you ever consolidate to a shared DB later, this ticket ensures the code is safe.

1. Create a Prisma client factory in `backend/src/lib/prismaClient.ts` that accepts a `tenantId` and uses a Prisma middleware to automatically append `where: { tenantId }` to all `findMany`, `findFirst`, `count`, `updateMany`, and `deleteMany` operations on models that have a `tenantId` field.
2. In `authMiddleware.ts`, extract `tenantId` from the verified JWT payload and attach it to `request.tenantId`.
3. In all route handlers, replace direct `prisma` calls with `getPrismaForTenant(request.tenantId)`.
4. Write a test that confirms a query made in tenant A's context cannot return tenant B's data, even if tenant B's IDs are used in the query.

**Done When:**
- All Prisma queries in route handlers use the tenant-scoped client.
- The cross-tenant data leakage test passes.

---

## Wave 3 — UX, Accessibility & Theme Audit
> **Goal:** Every screen passes WCAG 2.1 AA. Dark mode and light mode are fully correct on every element. The UI is touch-ready for tablet POS use.

---

### TICKET W3-01 — Add data-testid Attributes Throughout Frontend
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:** All files in `frontend/src/`

**Action:**
Add the following `data-testid` attributes. This is a prerequisite for W3-02 (the audit agent):

| Component / Element | Required data-testid |
|---|---|
| `ThemeToggle` button | `theme-toggle` |
| Navigation sidebar root | `nav-sidebar` |
| Every modal root element | `modal-{descriptive-name}` (e.g. `modal-discount`, `modal-receipt-preview`) |
| Toast/notification container | `toast-container` |
| `SyncStatusModal` root | `sync-status-modal` |
| Login form | `login-form` |
| Checkout cart container | `checkout-cart` |
| Checkout product grid | `checkout-product-grid` |
| Every page's main content area | `page-{route-name}` (e.g. `page-expiry-lots`) |
| Every confirmation dialog root | `dialog-confirm-{action}` |

**Done When:**
- All elements in the table above have their required `data-testid` attribute.
- No duplicate `data-testid` values exist in the DOM at any given time.

---

### TICKET W3-02 — Build the UI Theme Audit Agent
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W3-01  
**Files to create:**
- `audit/ui-theme-audit/` ← new directory
- `audit/ui-theme-audit/package.json`
- `audit/ui-theme-audit/audit.ts` ← main agent script
- `audit/ui-theme-audit/rules.ts` ← TC-01 through TC-10 rule implementations
- `audit/ui-theme-audit/report.ts` ← HTML report generator
- `audit/ui-theme-audit/modal-inventory.json` ← list of modals and how to trigger them

**Action:**
1. Install `playwright` and `@axe-core/playwright`: `npm install -D playwright @playwright/test @axe-core/playwright`
2. Implement the audit agent with the following flow:
   - Launch headless Chromium.
   - Log in with seeded admin credentials.
   - For each route in the route inventory (hard-coded list from `App.tsx`):
     a. Navigate to the route.
     b. Set **light mode**: remove `dark` class from `<html>` via `page.evaluate`.
     c. Take full-page screenshot.
     d. Run rules TC-01 through TC-10 (see rule definitions below).
     e. Run `@axe-core/playwright` scan; collect violations.
     f. Set **dark mode**: add `dark` class to `<html>` via `page.evaluate`.
     g. Take full-page screenshot.
     h. Re-run all rules.
     i. For each modal in `modal-inventory.json`: trigger it, screenshot, run rules, close it.
3. Implement rules in `rules.ts`:
   - **TC-01:** For every element with `data-testid` matching `page-*`, compare `background-color` in light vs dark mode — must differ.
   - **TC-02:** For every text element, compute contrast ratio between `color` and `background-color`; fail if below 4.5:1 (or 3:1 for `font-size >= 18px`).
   - **TC-03:** For every `input`, `textarea`, `select`: `border-color` must not equal `background-color` in either mode.
   - **TC-04:** For every `[data-testid^="modal-"]`: `background-color` must differ from `body` background.
   - **TC-05:** For every `svg` with a `fill` or `stroke`: contrast against nearest opaque background must be >= 3:1.
   - **TC-06:** For every `[data-testid="toast-container"] *`: no hard-coded hex in `background-color` computed style that is the same in both modes.
   - **TC-07:** For every `<table>`: odd-row `background-color` must differ from even-row in dark mode.
   - **TC-08:** For every focusable element: tab to it; `outline` must not be `none` and `box-shadow` must not be `none` simultaneously.
   - **TC-09:** For every element with `role="status"` or class containing `badge`/`pill`: text contrast >= 4.5:1.
   - **TC-10:** For every `[role="listbox"]` or `[role="menu"]`: `background-color` must differ from `body` background.
4. Generate an HTML report in `audit/ui-theme-audit/reports/` with:
   - Summary table: route × rule × mode → pass/fail.
   - For each failure: screenshot with red annotation box, element selector, computed values, fix suggestion.
   - Overall pass/fail badge.
5. Exit code 0 if zero TC failures; exit code 1 if any failures.
6. Add to `package.json` scripts: `"audit:ui": "ts-node audit/ui-theme-audit/audit.ts"`.

**Done When:**
- `npm run audit:ui` runs against the dev server and produces a report.
- The report correctly identifies elements that fail each rule.
- Exit code 1 when failures exist; 0 when all pass.

---

### TICKET W3-03 — Fix All TC Rule Failures Found by Audit Agent
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W3-02  
**Files:** Varies — guided by the audit report

**Action:**
1. Run `npm run audit:ui` and open the generated report.
2. For each failure:
   - **TC-01 (background not changing):** Find the element in the corresponding `.tsx` file. Ensure it uses a Tailwind `dark:` variant class or a CSS variable for its background (e.g. `bg-white dark:bg-gray-900`), not a hard-coded value.
   - **TC-02 (contrast):** Adjust text colour or background to meet 4.5:1 ratio. Use Tailwind's dark-mode text utilities.
   - **TC-03 (input border):** Add `border border-gray-300 dark:border-gray-600` to all form inputs.
   - **TC-04 (modal background):** Ensure modal uses `bg-white dark:bg-gray-800`.
   - **TC-05 (icon contrast):** Add `text-gray-700 dark:text-gray-300` to icon wrappers.
   - **TC-06 (toast hard-coded):** Replace hard-coded hex in toast styles with Tailwind classes.
   - **TC-07 (table rows):** Ensure table alternates `even:bg-gray-50 dark:even:bg-gray-800/50`.
   - **TC-08 (focus ring):** Add `focus:outline-none focus:ring-2 focus:ring-blue-500` to all interactive elements.
   - **TC-09 (badge contrast):** Fix badge text/background combination for dark mode.
   - **TC-10 (dropdown):** Ensure dropdowns use `bg-white dark:bg-gray-800 shadow-lg`.
3. Re-run the audit agent after each batch of fixes.
4. Continue until `npm run audit:ui` exits 0.

**Done When:**
- `npm run audit:ui` exits 0 with zero TC failures.
- `npm run build` (frontend) passes with no errors.

---

### TICKET W3-04 — WCAG 2.1 AA Accessibility Remediation
**Status:** `[ ]`  
**Priority:** HIGH  
**Depends on:** W3-02  
**Files:** Varies — guided by axe-core report

**Action:**
1. Run `npm run audit:ui` — the audit agent also runs axe-core and reports WCAG violations.
2. For each `critical` or `serious` axe-core violation:
   - **Missing alt text:** Add descriptive `alt` attributes to all `<img>` tags.
   - **Missing form labels:** Add `<label htmlFor=...>` or `aria-label` to all inputs.
   - **Keyboard trap:** Ensure all modals and drawers trap focus correctly and release on close.
   - **Missing ARIA roles:** Add `role`, `aria-expanded`, `aria-haspopup` to custom dropdowns and accordions.
   - **Colour contrast (from axe):** Same fixes as TC-02 above.
   - **Missing landmark regions:** Wrap main content in `<main>`, navigation in `<nav>`, headers in `<header>`.
3. Run a manual keyboard-only walkthrough: every action achievable via keyboard alone (Tab, Enter, Space, Escape, arrow keys).
4. Test with a screen reader (NVDA on Windows or VoiceOver on macOS) on the checkout flow and settings pages.

**Done When:**
- `axe-core` reports zero `critical` and zero `serious` violations across all routes.
- Keyboard-only checkout is fully functional.

---

### TICKET W3-05 — Touch Target Audit and Fix
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:** `frontend/src/` (all interactive elements)

**Action:**
1. Add a touch target audit step to the audit agent: for every interactive element (`button`, `a`, `input`, `[role="button"]`), measure `getBoundingClientRect()` and flag any element with `width < 44` or `height < 44` pixels.
2. Fix all flagged elements by adding `min-h-[44px] min-w-[44px]` Tailwind utilities or adjusting padding.
3. Pay special attention to:
   - POS checkout product grid buttons (must be tap-friendly on a 10" tablet).
   - Navigation sidebar links.
   - Table row action buttons (edit, delete icons).
   - Modal close buttons.
4. Test on a real tablet (or Chrome DevTools device simulator at iPad resolution) to validate usability.

**Done When:**
- Zero elements below 44×44px touch target in the audit report.
- Manual tablet-resolution test confirms comfortable tapping on all interactive elements.

---

### TICKET W3-06 — Add Loading Skeletons and Empty States
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `frontend/src/components/Skeleton.tsx` ← create
- `frontend/src/components/EmptyState.tsx` ← create
- All data-heavy page files

**Action:**
1. Create a reusable `Skeleton` component that renders animated grey placeholder bars. Variants: `line`, `card`, `table-row`.
2. Create a reusable `EmptyState` component with props: `icon`, `title`, `description`, `actionLabel`, `onAction`. Renders a centred illustration-style empty state.
3. Add `Skeleton` components to:
   - All tables while data is loading (show 5 skeleton rows).
   - Dashboard KPI tiles while metrics are fetching.
   - Product grid in checkout while products load.
4. Add `EmptyState` components to:
   - Inventory list when no products exist.
   - Sales transactions when no sales in the selected period.
   - Expiry lots when no near-expiry items.
   - Reports when no data matches the filter.
5. Every `EmptyState` must have a relevant call-to-action (e.g. "Add your first product" button on empty inventory).

**Done When:**
- Every data-heavy page shows a skeleton during its loading state.
- Every empty list shows a descriptive empty state with a relevant action button.
- Both components work correctly in dark mode and light mode.

---

### TICKET W3-07 — Add Keyboard Shortcut Cheat-Sheet Modal
**Status:** `[ ]`  
**Priority:** LOW  
**Files:**
- `frontend/src/components/ShortcutModal.tsx` ← create
- `frontend/src/hooks/useShortcutModal.ts` ← create
- `frontend/src/App.tsx` ← register global `?` keypress handler

**Action:**
1. Create `ShortcutModal.tsx`: a full-screen modal listing all keyboard shortcuts in two columns (global shortcuts and checkout-specific shortcuts).
2. Register a global `keydown` listener for `?` (while not focused in a text input) that opens the modal.
3. Document all existing shortcuts (e.g. from `POSCheckout.tsx`) in the modal with their descriptions.
4. Dismiss with `Escape`.
5. The modal must pass dark/light mode rules (will be verified by audit agent).

**Done When:**
- Pressing `?` from any non-input-focused context opens the shortcut modal.
- All active keyboard shortcuts are listed.
- Modal passes TC-04 rule.

---

### TICKET W3-08 — Build New Tenant Onboarding Wizard
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `frontend/src/pages/Onboarding.tsx` ← create
- `backend/src/routes/onboarding.ts` ← create
- `backend/src/index.ts` ← register route
- `frontend/src/App.tsx` ← redirect new tenants to onboarding

**Action:**
Build a 4-step onboarding wizard shown to new tenants on first login (when `hasCompletedOnboarding` is `false` on the tenant settings):

1. **Step 1 — Organisation details:** Name, logo upload, timezone, currency, base language.
2. **Step 2 — Payment setup:** Enable/configure at least one payment provider; test with dummy mode.
3. **Step 3 — First product:** Add at least one product to inventory (name, price, category, stock).
4. **Step 4 — Go live:** Summary of what was configured; link to docs; mark `hasCompletedOnboarding = true`.

Add `hasCompletedOnboarding Boolean @default(false)` to `TenantSettings` in Prisma schema. Redirect authenticated users with `hasCompletedOnboarding === false` to `/onboarding`.

**Done When:**
- A new tenant is redirected to the wizard on first login.
- After completing all 4 steps, `hasCompletedOnboarding` is `true` and the user lands on the main dashboard.
- The wizard works in dark and light mode.

---

## Wave 4 — Vertical Hardening
> **Goal:** Restaurant, pharmacy, and receiving verticals reach production-grade depth.

---

### TICKET W4-01 — KitchenBoard Real-Time WebSocket Push
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/src/index.ts` ← register fastify-websocket
- `backend/src/routes/kitchen.ts` ← add WebSocket endpoint
- `frontend/src/pages/KitchenBoard.tsx` ← replace polling with WebSocket

**Action:**
1. Install `@fastify/websocket`: `npm install @fastify/websocket`
2. Register the plugin in `index.ts`.
3. Add a WebSocket endpoint `GET /api/v1/kitchen/live` that:
   - Accepts a WebSocket upgrade.
   - On connection: sends the current list of open kitchen tickets as JSON.
   - On ticket create/update/bump (via the hook bus): broadcasts the updated ticket to all connected clients on the same tenant.
4. In `KitchenBoard.tsx`:
   - Replace the polling interval with a `WebSocket` connection to `/api/v1/kitchen/live`.
   - On message: update the ticket list in state.
   - On connection close: show a reconnecting indicator; attempt reconnect with exponential backoff.
5. Add ticket age colouring: tickets older than 5 minutes turn amber, older than 10 minutes turn red.
6. Add a bump button on each ticket: marks ticket as `COMPLETED`; removed from board.

**Done When:**
- Creating a restaurant order on one screen appears on KitchenBoard within 1 second without a page refresh.
- Ticket age colouring updates every minute.
- Bumping a ticket removes it from the board in real time.

---

### TICKET W4-02 — Pharmacy External Drug Interaction API
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/src/lib/drugInteractionService.ts` ← create
- `backend/src/routes/phase3.ts` ← update prescription interaction check

**Action:**
1. Create `drugInteractionService.ts` that:
   - Calls the OpenFDA drug interaction API: `https://api.fda.gov/drug/label.json?search=...`
   - Caches results in Redis with a 24-hour TTL to avoid redundant API calls.
   - Falls back to the local Prisma model if the API is unavailable.
   - Logs every interaction check to the audit trail with the prescribing context.
2. Update the prescription interaction check endpoint in `phase3.ts` to use the new service.
3. If an interaction is found: return a structured warning with severity level (`mild`, `moderate`, `severe`) and the interaction description.
4. Add an override workflow: a pharmacist can acknowledge and override a warning by providing a reason (persisted to `PrescriptionOverride` model, already in schema).

**Done When:**
- Prescribing a drug with a known interaction (e.g. warfarin + aspirin) returns a warning from the OpenFDA API.
- Interaction results are cached; a second identical check does not call the external API.
- Override is recorded in the audit trail.

---

### TICKET W4-03 — ReceivingCenter Production UX Redesign
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `frontend/src/pages/ReceivingCenter.tsx` ← full redesign

**Action:**
Redesign `ReceivingCenter.tsx` for operator-ready use:
1. **Session list view:** Table of open and recently completed receiving sessions. Columns: session ID, supplier, expected items, received items, discrepancy count, status.
2. **Active session view:** When a session is open, show a two-column layout:
   - Left: list of expected items from the purchase order (product name, expected qty, received qty so far, discrepancy badge).
   - Right: barcode scan input (auto-focused); typing or scanning a barcode auto-advances to the matching product and increments received quantity.
3. **Discrepancy highlight:** Rows where `received !== expected` are highlighted in amber (over) or red (under).
4. **Complete session button:** Disabled until all items have been scanned at least once. Confirmation modal shows discrepancy summary before completing.
5. All elements must pass dark/light mode rules.

**Done When:**
- An operator can complete a full receiving session using only a barcode scanner (no mouse).
- Discrepancies are clearly highlighted and summarised in the completion modal.
- The redesign passes the UI audit agent rules.

---

### TICKET W4-04 — Expiry Near-Expiry Alert Notifications
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/src/jobs/expiryAlertJob.ts` ← create
- `backend/src/index.ts` ← register cron job

**Action:**
1. Install `node-cron`: `npm install node-cron @types/node-cron`
2. Create `expiryAlertJob.ts`:
   - Runs daily at 06:00.
   - Queries all lots where `expiryDate <= now + 7 days` and `quantity > 0`.
   - Groups results by tenant.
   - For each tenant: calls `notificationService` to create an in-app notification listing the near-expiry items.
   - If the tenant has email alerts enabled: sends an email digest.
3. Register the job in `index.ts` on server start.
4. Add a `daysBeforeExpiry: Int @default(7)` field to `TenantSettings` so each org can configure the alert window.

**Done When:**
- A lot set to expire in 5 days triggers an in-app notification the next morning.
- The alert window is configurable per tenant.

---

## Wave 5 — Feature Expansion
> **Goal:** Add major new platform capabilities. Each ticket is independent; deliver in any order.

---

### TICKET W5-01 — Implement Production Coupon Code Engine
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/src/utils/discountEngine.ts` ← replace placeholder coupon validation

**Action:**
Replace the coupon code placeholder with full implementation:
1. Add `Coupon` model to Prisma schema: `code`, `type (PERCENT|FIXED|BOGO)`, `value`, `minBasket?`, `usageLimit?`, `usageCount`, `validFrom`, `validUntil?`, `applicableProductIds[]`, `applicableCategoryIds[]`, `combinable Boolean @default(false)`.
2. Run migration.
3. Implement `validateCoupon(code: string, basketTotal: number, lineItems: LineItem[], tenantId: string)`:
   - Looks up coupon by code and tenantId.
   - Checks: not expired, usage limit not reached, min basket met, products/categories match.
   - Returns either a `DiscountResult` or a typed error (expired, not found, limit reached, etc.).
4. Implement `applyCoupon(...)`: mutates the basket to apply the discount; increments `usageCount`.
5. Add coupon management endpoints: CRUD for coupons under `/api/v1/coupons`.
6. Add coupon management UI in settings.
7. Add coupon code field to `POSCheckout.tsx` with real-time validation feedback.

**Done When:**
- A valid coupon code at checkout applies the correct discount.
- An expired or already-redeemed coupon shows a specific error message.
- Coupon `usageCount` increments on redemption.

---

### TICKET W5-02 — Implement Gift Card System
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/src/utils/paymentEngine.ts` ← replace gift card placeholder
- `backend/prisma/schema.prisma` ← add GiftCard model
- `backend/src/routes/giftCards.ts` ← create

**Action:**
1. Add `GiftCard` model: `code`, `initialBalance`, `currentBalance`, `issuedAt`, `tenantId`, `redemptions[]`.
2. Run migration.
3. Implement full gift card flow:
   - Issue: `POST /api/v1/gift-cards` — creates a gift card with a random code and sets initial balance.
   - Check balance: `GET /api/v1/gift-cards/:code/balance`.
   - Redeem: on payment processing, if tender type is `GIFT_CARD`, deduct from `currentBalance`. If the card balance is less than the total, apply partial redemption and charge the remainder to another tender.
   - Top-up: `POST /api/v1/gift-cards/:code/topup`.
4. Replace the placeholder in `paymentEngine.ts` with calls to the above.
5. Add gift card as a tender option in `POSCheckout.tsx`.
6. Add gift card management page in settings.

**Done When:**
- A gift card can be issued, checked, and redeemed at checkout.
- Partial redemption correctly charges the remainder to a second tender.
- `paymentEngine.ts` has no placeholder comments.

---

### TICKET W5-03 — Implement Split Payment at Checkout
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/src/routes/payments.ts` ← support array of tenders
- `backend/prisma/schema.prisma` ← add PaymentTender model
- `frontend/src/pages/POSCheckout.tsx` ← add split tender UI

**Action:**
1. Add `PaymentTender` model: `saleId`, `type (CASH|CARD|GIFT_CARD|...)`, `amount`, `reference?`.
2. Modify the payment processing endpoint to accept `tenders: PaymentTender[]` instead of a single tender.
3. Validate that `sum(tenders.amount) >= saleTotal`; return change amount if overpaid in cash.
4. In `POSCheckout.tsx`, add a "Split Payment" button that opens a tender breakdown panel:
   - Each tender row: type selector + amount input.
   - Running total shows remaining balance.
   - "Charge" button enabled when total tenders cover the sale amount.

**Done When:**
- A $100 sale can be split as $60 cash + $40 card and both tenders are recorded on the sale.
- Change is calculated and displayed when cash amount exceeds the balance due.

---

### TICKET W5-04 — Add Tip/Gratuity Support
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/prisma/schema.prisma` ← add `tipAmount` to `Payment`
- `backend/src/routes/payments.ts` ← accept tip in payment request
- `frontend/src/pages/POSCheckout.tsx` ← add tip entry step

**Action:**
1. Add `tipAmount Decimal @default(0)` to the `Payment` model. Run migration.
2. Accept `tipAmount` in the payment request body; persist it on the `Payment` record.
3. In the checkout flow, after the order total is shown, add a tip selection step:
   - Preset buttons: 10%, 15%, 20%, custom amount.
   - Optional: configurable via tenant settings (enable/disable tips, preset percentages).
4. Include `tipAmount` in receipt display and in the reporting endpoints.
5. Add tip to the daily/weekly revenue reporting as a separate line item.

**Done When:**
- A $50 restaurant sale with a 15% tip records $7.50 tip on the Payment record.
- The receipt shows the subtotal, tip, and total separately.
- Tip amounts appear in the reporting dashboard.

---

### TICKET W5-05 — Refund Auto-Restock Inventory
**Status:** `[ ]`  
**Priority:** HIGH  
**Files:**
- `backend/src/routes/sales.ts` ← update refund handler

**Action:**
1. Add `restockOnRefund Boolean @default(true)` to the refund request body schema.
2. In the refund handler, after marking the sale as refunded:
   - If `restockOnRefund === true`: create an `InventoryTransaction` of type `RETURN` for each refunded line item, incrementing stock.
   - Log to audit trail: `refund:restock` with quantities and product IDs.
3. In `POSCheckout.tsx` and wherever the refund UI exists, add a "Restock inventory" checkbox (default: checked) to the refund confirmation modal.
4. Show the new inventory quantity in the refund confirmation summary.

**Done When:**
- Refunding a sale with `restockOnRefund: true` increases the product's inventory count by the refunded quantity.
- The audit trail records the restock event.
- The refund modal shows the restock checkbox.

---

### TICKET W5-06 — Expand Products Route (Variants, Images, Search)
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/src/routes/products.ts` ← expand
- `backend/prisma/schema.prisma` ← add ProductVariant, ProductImage models

**Action:**
1. Add `ProductVariant` model: `productId`, `name`, `sku`, `price`, `stockQuantity`, `attributes (Json)`.
2. Add `ProductImage` model: `productId`, `url`, `isPrimary Boolean`, `sortOrder Int`.
3. Run migration.
4. Expand `products.ts` with:
   - `GET /api/v1/products?search=&category=&lowStock=` — full-text search on name/SKU, filter by category and low-stock flag.
   - `POST /api/v1/products/:id/images` — accepts a multipart image upload; stores via a configurable adapter (local disk or S3-compatible).
   - `POST /api/v1/products/:id/variants` — creates a variant.
   - `PUT /api/v1/products/:id/variants/:variantId` — updates variant price/stock.
5. Update the checkout product grid to show variants in a dropdown on product selection.

**Done When:**
- Products can have multiple variants (e.g. sizes, colours) each with independent pricing and stock.
- Product images can be uploaded and displayed in the checkout grid.
- The product search endpoint returns filtered results by name, SKU, and category.

---

### TICKET W5-07 — Scheduled Report Delivery
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/prisma/schema.prisma` ← add ReportSchedule model
- `backend/src/jobs/reportDeliveryJob.ts` ← create
- `backend/src/routes/reports.ts` ← add schedule CRUD endpoints
- `frontend/src/pages/settings/ReportSettings.tsx` ← create

**Action:**
1. Add `ReportSchedule` model: `tenantId`, `reportType`, `frequency (DAILY|WEEKLY|MONTHLY)`, `deliveryTime`, `recipients []String`, `format (PDF|CSV)`, `lastRunAt?`, `enabled Boolean`.
2. Create `reportDeliveryJob.ts`: runs every hour; checks for schedules due to run; generates the report; emails it via `emailService`.
3. Add CRUD endpoints for report schedules.
4. Build `ReportSettings.tsx`: list of configured schedules; form to add/edit schedules with report type selector, frequency, time, email recipients, and format.

**Done When:**
- A daily sales summary report is emailed at the configured time.
- Report schedule CRUD works in the settings UI.

---

### TICKET W5-08 — Real-Time Sales Dashboard
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Depends on:** W4-01 (WebSocket infrastructure)  
**Files:**
- `backend/src/routes/dashboard.ts` ← add live KPI WebSocket endpoint
- `frontend/src/pages/Dashboard.tsx` ← add live tiles

**Action:**
1. Add `GET /api/v1/dashboard/live` WebSocket endpoint that broadcasts a KPI snapshot every 30 seconds:
   - Sales count today, revenue today, average basket today.
   - Current active cart sessions.
   - Low stock alerts count.
   - Sync dead-letter count.
2. In `Dashboard.tsx`, connect to the WebSocket and display:
   - Live KPI tiles (update in place with a subtle flash animation).
   - A "last updated" timestamp.
   - Connection status indicator (green = live, amber = reconnecting, red = disconnected).
3. Fall back to polling (`GET /api/v1/reports/sales-summary?period=today`) if WebSocket is unavailable.

**Done When:**
- Dashboard KPI tiles update in real time as sales are processed.
- Dashboard works in both dark and light mode.

---

### TICKET W5-09 — Staff Management and Clock-In/Out
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/prisma/schema.prisma` ← add Employee, TimeClock models
- `backend/src/routes/staff.ts` ← create
- `frontend/src/pages/Staff.tsx` ← create
- `frontend/src/pages/ClockIn.tsx` ← create

**Action:**
1. Add `Employee` model: `userId`, `tenantId`, `pin (hashed)`, `hireDate`, `role`, `hourlyRate?`.
2. Add `TimeClock` model: `employeeId`, `tenantId`, `clockedInAt`, `clockedOutAt?`, `breakMinutes Int @default(0)`.
3. Create staff API endpoints: CRUD for employees, clock-in/clock-out, timesheet query.
4. Build `Staff.tsx`: employee list with status badges (clocked in / out), add/edit employee form.
5. Build `ClockIn.tsx`: PIN pad screen available from the main nav. Employee enters their PIN; system records clock-in or clock-out.
6. Add labour cost to the daily reporting API: total hours worked × hourly rate per employee.

**Done When:**
- An employee can clock in and out via PIN on any terminal.
- The timesheet is visible per employee in the staff management page.
- Labour cost appears in daily reporting.

---

### TICKET W5-10 — Loyalty Points and Customer CRM
**Status:** `[ ]`  
**Priority:** MEDIUM  
**Files:**
- `backend/prisma/schema.prisma` ← add CustomerProfile, LoyaltyTransaction models
- `backend/src/routes/customers.ts` ← create
- `frontend/src/pages/Customers.tsx` ← create
- `frontend/src/pages/POSCheckout.tsx` ← add customer lookup and points redemption

**Action:**
1. Add `CustomerProfile` model: `tenantId`, `name`, `email`, `phone`, `birthDate?`, `tier (BRONZE|SILVER|GOLD)`, `pointsBalance Int @default(0)`.
2. Add `LoyaltyTransaction` model: `customerId`, `saleId?`, `type (EARN|REDEEM|ADJUST)`, `points`, `createdAt`.
3. Implement loyalty rules in `backend/src/lib/loyaltyService.ts`:
   - Earn: 1 point per $1 (configurable via tenant settings).
   - Redeem: 100 points = $1 discount.
   - Tiers: Bronze (0–499 pts), Silver (500–1999 pts), Gold (2000+ pts); higher tiers earn faster.
4. Create customer CRUD endpoints; add customer search by name/email/phone.
5. Build `Customers.tsx`: customer list with search, tier badges, LTV, and point balance.
6. In `POSCheckout.tsx`: add customer lookup field; display points balance; allow points redemption at checkout.

**Done When:**
- A customer is looked up at checkout, points are earned on sale completion, and can be redeemed in future transactions.
- Customer tier upgrades automatically when point threshold is crossed.

---

## Appendix A — Stub Resolution Checklist

| File | Stub | Resolving Ticket |
|---|---|---|
| `backend/src/utils/logger.ts` | Stub logger | W1-01 |
| `backend/src/utils/idempotency.ts` | Placeholder idempotency | W1-02 |
| `backend/src/routes/payments.ts` | Email receipt TODO | W1-03 |
| `frontend/src/lib/security.ts` | Security event transport TODO | W1-09 |
| `backend/src/utils/discountEngine.ts` | Coupon validation placeholder | W5-01 |
| `backend/src/utils/paymentEngine.ts` | Gift card validation placeholder | W5-02 |
| `frontend/src/pages/KitchenBoard.tsx` | Console-style UX | W4-01 |
| `frontend/src/pages/ReceivingCenter.tsx` | Console-style UX | W4-03 |
| `frontend/src/pages/PharmacyConsole.tsx` | Console-style UX | W4-02 (partial) |
| `backend/src/routes/products.ts` | Thin route surface | W5-06 |
| `backend/src/routes/purchases.ts` | Thin route surface | W5-03 (partial) |

---

## Appendix B — Definition of Done (Platform-Wide)

A ticket is **DONE** when:
- [ ] The described behaviour works end-to-end (not just the happy path).
- [ ] TypeScript builds with zero errors (`npm run build`).
- [ ] Existing tests still pass (`npm test`).
- [ ] At least one new test covers the new behaviour.
- [ ] No new TODO/FIXME/STUB/PLACEHOLDER comments are introduced.
- [ ] Dark mode and light mode both render correctly for any new UI elements.
- [ ] The ticket's **Done When** criteria are met exactly.

The **platform** is production-ready when:
- [ ] All Wave 1 tickets are `[x]`.
- [ ] All Wave 2 tickets are `[x]`.
- [ ] `npm run audit:ui` exits 0.
- [ ] `axe-core` reports zero critical violations.
- [ ] `simulate-restore-drill.sh` exits 0.
- [ ] All CI gate scripts are wired and passing.
- [ ] MFA is enforced for all ADMIN and MANAGER accounts.
- [ ] New org provisioned in under 5 minutes by running `provision-org.sh`.

---

## Appendix C — Technology Reference

| Concern | Package | Install Command |
|---|---|---|
| Structured logging | `pino` + `pino-pretty` | `npm install pino pino-pretty` |
| Idempotency store | `ioredis` | `npm install ioredis` |
| Email delivery | `nodemailer` | `npm install nodemailer @types/nodemailer` |
| Rate limiting | `@fastify/rate-limit` | `npm install @fastify/rate-limit` |
| Input validation | `zod` | `npm install zod` |
| MFA | `speakeasy` + `qrcode` | `npm install speakeasy qrcode @types/speakeasy @types/qrcode` |
| WebSockets | `@fastify/websocket` | `npm install @fastify/websocket` |
| Scheduled jobs | `node-cron` | `npm install node-cron @types/node-cron` |
| UI testing | `playwright` | `npm install -D playwright @playwright/test` |
| WCAG scanning | `@axe-core/playwright` | `npm install -D @axe-core/playwright` |
| i18n | `react-i18next` | `npm install react-i18next i18next` |
| Barcode scanning | `zxing-wasm` | `npm install zxing-wasm` |
| Reverse proxy | Traefik v3 | Docker image `traefik:v3` |
| Load testing | k6 | https://k6.io/docs/get-started/installation/ |

---

*End of Aether POS Agent Execution Plan — update ticket statuses as work is completed.*
