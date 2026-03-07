# Changelog - 2026-03-07 (P8-B Completed, P8-C Kickoff Baseline)

## Summary
This push consolidates security and operations work from Phase 8-B, TypeScript hardening across backend services, frontend settings/security UX updates, and reporting/transaction visibility additions. It also captures plan expansion and runbook documentation for Phase 8 execution.

## Planning and Documentation
- Expanded unified execution plan in `AGENT_EXECUTION_UNIFIED_PLAN.md`.
- Added sub-agent-ready addendum with concrete phase workstreams and acceptance criteria.
- Added explicit Phase 8 implementation map and first packet definitions.
- Added backup/restore operations runbook:
  - `docs/P8_BACKUP_RESTORE_RUNBOOK.md`

## Backend Changes
### Security, Compliance, and Operations
- Extended security routes and operational endpoints in:
  - `backend/src/routes/security.ts`
- Strengthened security compliance/event persistence flow in:
  - `backend/src/lib/securityCompliance.ts`
- Updated notifications and settings integrations for security operations in:
  - `backend/src/routes/notifications.ts`
  - `backend/src/routes/settings.ts`

### TypeScript and Runtime Hardening
- Applied strict typing and compatibility fixes across middleware, routes, and payment adapters:
  - `backend/src/middleware/compression.ts`
  - `backend/src/middleware/brute-force.ts`
  - `backend/src/middleware/security.ts`
  - `backend/src/routes/payments.ts`
  - `backend/src/lib/payments/stripe.ts`
  - `backend/src/lib/payments/square.ts`
  - `backend/src/lib/payments/paypal.ts`
  - `backend/src/lib/encryption.ts`
  - `backend/src/lib/queries.ts`
  - `backend/src/routes/roles.ts`
  - `backend/src/routes/users.ts`
  - `backend/src/utils/audit.ts`
  - `backend/src/routes/audit.ts`
- Added Fastify request typing augmentation:
  - `backend/src/types/fastify.d.ts`
- Added backup/restore simulation script:
  - `backend/scripts/simulate-restore-drill.js`
- Added alert rules service:
  - `backend/src/lib/alertService.ts`

### Build Output Included in This Push
- Backend compiled artifacts were generated and included under:
  - `backend/dist/**`

## Frontend Changes
### Security and Settings UX
- Security API client enhancements:
  - `frontend/src/lib/securityAPI.ts`
- Security settings page updates:
  - `frontend/src/pages/settings/SecuritySettings.tsx`
- Supporting settings updates:
  - `frontend/src/pages/settings/SystemSettings.tsx`
  - `frontend/src/pages/settings/StoreSettings.tsx`

### Reporting and Transaction Visibility
- Added reporting transaction pages:
  - `frontend/src/pages/SalesTransactions.tsx`
  - `frontend/src/pages/PurchasesTransactions.tsx`
- Wired route/menu updates in:
  - `frontend/src/App.tsx`

### UI Component Refinements
- Updated modals and role/sync components:
  - `frontend/src/components/CreateProductModal.tsx`
  - `frontend/src/components/EditProductModal.tsx`
  - `frontend/src/components/CreateUserModal.tsx`
  - `frontend/src/components/EditUserModal.tsx`
  - `frontend/src/components/RolePermissionMatrix.tsx`
  - `frontend/src/components/SyncStatusModal.tsx`

### Build/Dependency Updates
- Added minifier dependency and lockfile updates:
  - `frontend/package.json`
  - `frontend/package-lock.json`
- Updated generated frontend build outputs:
  - `frontend/dist/index.html`
  - `frontend/dist/assets/main-DUpq3PMS.js`
  - `frontend/dist/assets/main-fvZz_o0o.css`
  - `frontend/dist/sw.js`
- Removed previous build hashes:
  - `frontend/dist/assets/index-D2pZ_Z7g.js`
  - `frontend/dist/assets/index-TflpbvAu.css`

## Notes
- This commit intentionally includes generated build artifacts currently present in repository changes.
- Follow-up cleanup (if desired): normalize `.gitignore` rules and remove tracked build output in a dedicated maintenance commit.
