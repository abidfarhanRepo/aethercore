# CI Gates (Local-Only)

This project runs release gates locally. GitHub is used to store code only.
No GitHub Actions/workflows are required or enabled for release gating.

## Gate scripts

All gate scripts are in `backend/scripts`:

- `gate-migration-drift.js`
- `gate-pre-release-evidence.js`
- `gate-post-release-evidence.js`
- `run-all-gates.js` (local orchestrator)

## NPM commands

From `backend/`:

- `npm run gate:migrate`
- `npm run gate:pre-release`
- `npm run gate:post-release`
- `npm run gate:all`

`npm run gate:all` runs the three gate checks sequentially and fails fast.

## What each gate checks

### 1) Migration drift gate

Command: `npm run gate:migrate`

Checks Prisma drift using:

- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`

Pass condition:

- Exit code indicates schema and migration history are aligned.

Fail condition:

- Drift is detected, or Prisma cannot complete the check.

### 2) Pre-release evidence gate

Command: `npm run gate:pre-release`

Checks:

- Backend health endpoint is reachable and DB health is OK.
- No unresolved critical security events in the lookback window.

Pass condition:

- Health check passes and unresolved critical event count is 0.

### 3) Post-release evidence gate

Command: `npm run gate:post-release`

Checks:

- Recent key rotation evidence exists in lookback window.
- Rotation notification fanout evidence exists (admin, plus manager when required).

Pass condition:

- Rotation and notification checks pass.

## Required environment variables

Use `backend/.env` (or env exports) as needed:

- `RELEASE_GATE_BASE_URL` (default `http://127.0.0.1:4000`)
- `RELEASE_GATE_BEARER_TOKEN` (optional)
- `RELEASE_GATE_ADMIN_EMAIL` and `RELEASE_GATE_ADMIN_PASSWORD` (optional auth fallback)
- `RELEASE_GATE_MANAGER_BEARER_TOKEN` (optional)
- `RELEASE_GATE_MANAGER_EMAIL` and `RELEASE_GATE_MANAGER_PASSWORD` (optional)
- `RELEASE_GATE_HTTP_TIMEOUT_MS` (optional)
- `PRE_RELEASE_LOOKBACK_HOURS` (optional, default `24`)
- `POST_RELEASE_LOOKBACK_HOURS` (optional, default `24`)
- `POST_RELEASE_REQUIRE_MANAGER_EVIDENCE` (optional, default `false`)

## Evidence artifacts

Each gate writes evidence JSON under:

- `backend/artifacts/release-gates/`

Every run produces:

- Timestamped artifact file
- `*.latest.json` pointer file

## Local docker image build flow (no GitHub workflows)

Run this from repository root:

1. `cd backend && npm run gate:all`
2. `cd .. && docker compose build backend frontend`

For production compose image tags:

1. Set `DOCKER_REGISTRY` and `IMAGE_TAG`
2. `docker compose -f docker-compose.prod.yml build backend frontend`

This keeps all build and gate execution local, with no remote workflow dependency.
