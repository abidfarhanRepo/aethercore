# W1-09 Security Event Transport (2026-03-10)

## Scope
Implemented frontend security event transport with backend ingestion for:
- `auth.login_failed`
- `auth.mfa_failed`
- `authz.capability_denied`
- `session.idle_lock`

## Delivered Behavior
- Frontend `logSecurityEvent(...)` now POSTs to `POST /api/v1/security/events`.
- Payload shape is:
  - `type: string`
  - `severity: 'low' | 'medium' | 'high'`
  - `context: Record<string, unknown>`
  - `timestamp: string`
- Failed sends are queued in-memory and flushed on next successful send.
- Backend persists events and exposes them via `GET /api/v1/security/events`.

## Backend Mapping
Frontend types map to `SecurityEventType` as follows:
- `auth.login_failed` -> `FAILED_LOGIN`
- `auth.mfa_failed` -> `MFA_FAILED`
- `authz.capability_denied` -> `CAPABILITY_DENIED`
- `session.idle_lock` -> `IDLE_LOCK`

DB enum extended via migration:
- `backend/prisma/migrations/20260309170000_add_security_event_types/migration.sql`

## Key Files
- `frontend/src/lib/security.ts`
- `frontend/src/components/Login.tsx`
- `frontend/src/pages/auth/MfaChallenge.tsx`
- `frontend/src/lib/auth.ts`
- `frontend/src/App.tsx`
- `frontend/src/lib/securityAPI.ts`
- `frontend/src/lib/security.test.ts`
- `backend/src/routes/security.ts`
- `backend/src/middleware/capabilityMiddleware.ts`
- `backend/src/routes/auth.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260309170000_add_security_event_types/migration.sql`

## Validation Summary
Unit/integration checks used during implementation:
- `npx jest src/lib/security.test.ts --runInBand` (frontend): PASS
- `npx jest --runInBand src/__tests__/auth.verify-pin.test.ts --reporters=default` (backend): PASS
- `npx prisma migrate deploy` (backend): migration applied

Runtime verification (updated backend instance):
- `GET /api/v1/health` -> `200`
- `POST /api/v1/security/events` for all four event types -> `201`
- `GET /api/v1/security/events?limit=100` -> `200`
- Verified stored enum types: `FAILED_LOGIN`, `MFA_FAILED`, `CAPABILITY_DENIED`, `IDLE_LOCK`
- Invalid payload check -> `400`

## Rollback Notes
If rollback is needed:
- Revert source changes in frontend/backend files listed above.
- Keep migration history immutable; if enum values must be deprecated, map unused values to `UNKNOWN` at application level.
