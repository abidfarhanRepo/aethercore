# Phase 8 Backup and Restore Runbook (P8-01)

Last updated: 2026-03-07
Scope: non-production restore simulation and security-event evidence capture.

## Purpose

This runbook defines the operational path for P8-01:
- daily backup process definition,
- weekly restore simulation execution,
- drill evidence persistence in security/ops history.

## Current Implementation Surface

Backend endpoints:
- `GET /api/security/backup-drills` (ADMIN, MANAGER) - list drill events
- `POST /api/security/backup-drills/simulate-restore` (ADMIN) - run a non-production restore simulation
- `GET /api/security/events` (ADMIN, MANAGER) - full security event history including drill events

CLI script:
- `backend/scripts/simulate-restore-drill.js`
- npm aliases:
  - `npm run ops:simulate-restore-drill`
  - `npm run ops:simulate-restore-drill:latest`

Security event persistence:
- Drill outcomes are persisted to `SecurityEvent` with:
  - `source`: `api/security/backup-drills` or `cli/security/backup-drills`
  - `details.drillId`
  - `details.drillType` (`weekly_restore_simulation`)
  - `details.eventKind` (`RESTORE_SIMULATION_*`)
  - `details.status` (`in_progress|completed|failed`)

## Daily Backup Process (Operational Baseline)

The repository does not yet enforce storage-provider-specific backup automation in code.
Current baseline for P8-01 is:
1. Define backup schedule in deployment platform (recommended 02:00 UTC daily).
2. Persist schedule metadata in ops documentation.
3. Verify backup availability before weekly drill.

Recommended environment-level controls:
- encrypted backup target (S3/GCS/Azure/local vault)
- retention policy (recommended: 30 days)
- alert if latest successful backup age > 25h

## Weekly Restore Simulation Procedure

Preconditions:
- never run in production (`NODE_ENV=production` is blocked)
- working DB connection
- ADMIN token for API mode, or local runtime for CLI mode

### Option A: API-triggered simulation

1. Authenticate as admin:
```bash
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aether.dev","password":"password123"}'
```

2. Trigger restore drill:
```bash
curl -X POST http://localhost:4000/api/security/backup-drills/simulate-restore \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"snapshotId":"latest-backup","expectedMinRecords":0}'
```

3. Verify evidence:
```bash
curl -s "http://localhost:4000/api/security/backup-drills?limit=20" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Option B: CLI-triggered simulation

```bash
cd backend
npm run ops:simulate-restore-drill:latest
```

Optional:
```bash
cd backend
npm run ops:simulate-restore-drill -- --snapshot-id=latest-backup --actor-id=system
```

## Evidence Query and Audit

Primary evidence endpoints:
- `GET /api/security/backup-drills`
- `GET /api/security/events`

Audit signals to verify:
- initiated event exists for drill ID
- completed or failed event exists for same drill ID
- `details.status` and `details.counts` are present on completion
- `severity` is `HIGH` for failures

## Failure Handling

Common failures:
- database connectivity issues
- low record validation threshold mismatch
- forced simulation failure input

Actions:
1. collect failed drill event payload from `backup-drills` endpoint
2. inspect `details.error`
3. rerun drill after remediation
4. keep failure evidence (do not delete events)

## Rollback Guidance

If drill execution flow causes operational noise:
1. temporarily disable automated drill triggers in scheduler/CI
2. keep API endpoints and event persistence enabled for audit continuity
3. continue manual drills via CLI until automation is stable

## P8-01 Done Criteria

- Daily backup process is documented and executable by ops.
- Weekly restore simulation can be executed via API or CLI in non-production.
- Drill outcomes are persisted and queryable in security event history.
