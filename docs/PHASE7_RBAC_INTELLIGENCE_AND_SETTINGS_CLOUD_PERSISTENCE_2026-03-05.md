# Phase 7 RBAC, Intelligence, and Settings Cloud Persistence (2026-03-05)

## 1. Executive Summary
This delivery completes the Phase 7 reporting/intelligence implementation and hardens settings persistence so settings saved in the UI are stored in the backend database and available across machines.

Delivered outcomes:
- Role-scoped reporting and intelligence APIs for sales, purchases, KPI packs, and purchase recommendations.
- Strict export authorization (`reports.export`) on CSV report export.
- Deterministic recommendation logic with explainability metadata.
- Settings API upsert behavior so missing keys are created server-side during save.
- Integration coverage for RBAC/reporting and cloud settings persistence.

## 2. Backend Changes

### 2.1 Reporting and Intelligence
- `backend/src/lib/reportingIntelligence.ts` (new)
- `backend/src/routes/reportingIntelligence.ts` (new)
- `backend/src/index.ts` (route registration)
- `backend/src/routes/reports.ts` (auth and permission gates)

Highlights:
- Added role capability helpers for combined reporting, sales detail visibility, purchases visibility, and purchase intelligence access.
- Added endpoints:
  - `GET /api/reports/sales/visible`
  - `GET /api/reports/sales/:id/visible`
  - `GET /api/reports/purchases/visible`
  - `GET /api/reports/purchases/:id/visible`
  - `GET /api/reports/intelligence/purchase-recommendations`
  - `GET /api/reports/intelligence/kpis`
- Added global report guards on `reports.ts`:
  - `requireAuth`
  - `requirePermission('reports.view')`
- Added export hard gate:
  - `GET /api/reports/export/csv` requires `requirePermission('reports.export')`.

### 2.2 Settings Cloud Persistence
- `backend/src/routes/settings.ts`

Highlights:
- `PUT /api/settings/:key` now supports create-or-update persistence.
- Added metadata support in update payload: `category`, `type`, `label`, `description`, `isEncrypted`.
- Returns proper status codes:
  - `201` for create
  - `200` for update
  - `400` for validation
  - `404` for missing get
  - `409` for duplicate create
- Replaced schema `oneOf` with `anyOf` for primitive value validation compatibility.

## 3. Frontend Changes
- `frontend/src/lib/api.ts`
- `frontend/src/lib/settingsAPI.ts`
- `frontend/src/pages/Settings.tsx`

Highlights:
- Added client methods for new reporting/intelligence endpoints.
- Updated settings update API to send structured payload (value + metadata), not value-only.
- Simplified settings save flow to rely on backend upsert behavior.
- Added category inference for settings keys so saved values are categorized consistently.

## 4. API Contract Summary

New reporting/intelligence routes:
- `GET /api/reports/sales/visible`: role-scoped sales list.
- `GET /api/reports/sales/:id/visible`: role-scoped sale detail.
- `GET /api/reports/purchases/visible`: role-scoped purchase list.
- `GET /api/reports/purchases/:id/visible`: role-scoped purchase detail.
- `GET /api/reports/intelligence/purchase-recommendations`: deterministic recommendations with explainability.
- `GET /api/reports/intelligence/kpis`: role/vertical scoped KPI payload with formulas.

Updated routes:
- `GET /api/reports/export/csv`: now permission-gated by `reports.export`.
- `PUT /api/settings/:key`: now supports cloud upsert behavior.

## 5. RBAC Matrix (Reporting/Intelligence)
- `ADMIN`, `MANAGER`, `SUPERVISOR`:
  - combined sales visibility
  - combined purchases visibility
  - KPI and recommendation access
- `CASHIER`:
  - own-sales visibility only
  - denied purchases visibility and purchase recommendations
- `STOCK_CLERK`:
  - denied sales visibility routes
  - purchases visibility restricted to own purchase orders
  - allowed purchase recommendations and stock-focused KPI outcomes

## 6. Cloud Settings Persistence Behavior
Guarantees now in place:
- Settings saves are persisted to backend DB via `PUT /api/settings/:key`.
- If a setting key does not exist, backend creates it during save.
- Reads are server-backed (`GET /api/settings*`), so switching machines still loads the same settings.

Role constraints:
- Settings routes remain protected by auth and manager/admin role checks in backend.

## 7. Testing Evidence
Integration suites executed successfully:
- `backend/__tests__/integration/reporting-rbac.integration.test.ts`
- `backend/__tests__/integration/settings-cloud-persistence.integration.test.ts`

Verified assertions:
- Sales/purchase visibility boundaries per role.
- Export permission gate behavior.
- Deterministic recommendation payload includes explainability fields.
- Settings created/updated in one app instance are read from a second app instance (cross-device equivalence).

## 8. Operational Notes
- Verification used an isolated test schema on the configured Postgres target to avoid mutating primary runtime data.
- Hosted DB advisory lock timing may intermittently affect migration steps; rerun of tests against an already migrated schema was stable.

## 9. Rollback Guidance
If rollback is required:
1. Revert backend files:
   - `backend/src/routes/reportingIntelligence.ts`
   - `backend/src/lib/reportingIntelligence.ts`
   - `backend/src/routes/reports.ts`
   - `backend/src/routes/settings.ts`
   - `backend/src/index.ts`
2. Revert frontend files:
   - `frontend/src/lib/api.ts`
   - `frontend/src/lib/settingsAPI.ts`
   - `frontend/src/pages/Settings.tsx`
3. Remove test files:
   - `backend/__tests__/integration/reporting-rbac.integration.test.ts`
   - `backend/__tests__/integration/settings-cloud-persistence.integration.test.ts`

## 10. Verification Commands
Run from `backend/`:

```powershell
$raw=(Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
$base=($raw -replace '^DATABASE_URL=','').Trim('"')
$schema='phase7_runtime_verify_20260305'
if ($base -match '\?') { $env:TEST_DATABASE_URL="$base&schema=$schema" } else { $env:TEST_DATABASE_URL="$base?schema=$schema" }
npx jest --runInBand __tests__/integration/settings-cloud-persistence.integration.test.ts __tests__/integration/reporting-rbac.integration.test.ts --reporters=default
```
