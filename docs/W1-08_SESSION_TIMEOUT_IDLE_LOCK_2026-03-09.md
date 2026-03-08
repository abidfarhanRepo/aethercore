# W1-08 Session Timeout and Idle Lock Progress (2026-03-09)

## Status
- Ticket: `W1-08`
- Current status: `in progress` (`[~]`)
- Scope in this update: core idle-lock and PIN flow foundation

## Implemented

### Backend
- Added user PIN storage field:
  - `User.pinHash String?` in `backend/prisma/schema.prisma`
  - Migration: `backend/prisma/migrations/20260309102000_add_user_pin_hash/migration.sql`
- Added PIN verification endpoint:
  - `POST /api/v1/auth/verify-pin`
  - Verifies 4-8 digit PIN against `pinHash`
- Added PIN set/update endpoint:
  - `PUT /api/v1/users/:id/pin`
  - Allowed for self or admin
  - Audit log entry: `PIN_UPDATED`
- Updated auth responses to include `hasPinSet` for client lock behavior:
  - login
  - MFA challenge completion
  - `/api/v1/auth/me`
- Updated access token lifetime to 8 hours in JWT utility:
  - `backend/src/lib/jwt.ts`

### Frontend
- Added idle timer hook:
  - `frontend/src/hooks/useIdleTimer.ts`
  - Tracks `mousemove`, `keydown`, `touchstart`, `mousedown`
- Added lock overlay component:
  - `frontend/src/components/IdleLockScreen.tsx`
  - Unlock by PIN (`/api/v1/auth/verify-pin`)
  - Force logout fallback
- Integrated idle lock into app shell:
  - `frontend/src/App.tsx`
  - Default timeout: 10 minutes
  - Checkout timeout: 30 minutes
- Extended settings MFA page with PIN management:
  - `frontend/src/pages/settings/MfaSettings.tsx`
  - Save/update lock PIN
- Extended API/auth types:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/auth.ts`

## Verification Performed
- `npm --prefix backend run build` passed
- `npm --prefix frontend run build` passed
- Dev server smoke check (via sub-agent):
  - Backend `http://localhost:4000/health` returns `ok`
  - Frontend `http://localhost:5175` serving app

## Remaining Work for Full W1-08 Completion
- Add explicit tenant-scoped persistent idle timeout model/flow matching ticket wording (`idleTimeoutMinutes` in tenant settings model)
- Add integration tests for idle trigger and unlock flow
- Add explicit lockout/rate-limit policy around PIN verification attempts

## Notes
- W1-08 is intentionally not marked complete yet.
- This change set establishes the end-to-end core lock/unlock behavior and 8-hour session lifetime baseline.
