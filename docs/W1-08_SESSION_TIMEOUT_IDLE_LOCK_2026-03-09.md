# W1-08 Session Timeout and Idle Lock Progress (2026-03-09)

## Status
- Ticket: `W1-08`
- Current status: `complete` (`[x]`)
- Scope: session timeout, idle lock, PIN unlock, and tenant-configurable timeout

## Implemented

### Backend
- Tenant-scoped idle timeout is implemented through `TenantSettings.idleTimeoutMinutes` and exposed via tenant settings read/update endpoints.
- PIN verification endpoint (`POST /api/v1/auth/verify-pin`) includes lockout policy:
  - 5 failed attempts
  - 15-minute lock window
  - `Retry-After` returned while locked
- PIN set/update endpoint (`PUT /api/v1/users/:id/pin`) remains available for self/admin flows with audit logging.
- Auth payloads include `hasPinSet` for lock-screen behavior and unlock gating.

### Frontend
- Idle timer + lock overlay flow is active in app shell.
- Settings wiring now fetches and updates tenant idle timeout through settings APIs.
- PIN unlock UX uses `POST /api/v1/auth/verify-pin` and honors backend lockout/Retry-After responses.

## Verification
- `backend/src/__tests__/auth.verify-pin.test.ts` added and passing for PIN verification and lockout behavior.
- `frontend/src/hooks/useIdleTimer.test.ts` added and passing for idle timer behavior.
- `frontend/src/components/IdleLockScreen.test.tsx` added and passing for lock screen unlock/error flows.
- Build and smoke checks remain green for backend and frontend.

## Closure Criteria Met (Done When)
- Done When: Idle timeout is tenant-configurable and persisted.
  - Met via `TenantSettings.idleTimeoutMinutes` with settings endpoint integration.
- Done When: Locked session requires PIN unlock with abuse protection.
  - Met via verify-pin lockout policy (5 attempts / 15 minutes) and `Retry-After` signaling.
- Done When: Frontend reflects and manages tenant timeout settings.
  - Met via settings page fetch/update wiring and runtime timeout application.
- Done When: Coverage exists for core idle lock and unlock paths.
  - Met via backend and frontend tests listed in Verification.
