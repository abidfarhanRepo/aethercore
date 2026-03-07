# Aether POS - Unified Execution Plan (As-Built)

Last updated: 2026-03-07
Scope: This file is now an as-built execution ledger based on implemented code, with explicit gaps and stubs.

## 1. Purpose
This document is the single source of truth for:
- What has actually been implemented in the repository.
- What remains partial, stubbed, or not production-complete.
- The next execution packets to close remaining risk.

This plan supersedes earlier aspirational text where implementation status has changed.

## 2. Baseline Architecture (Implemented)
- Backend: Fastify + Prisma + TypeScript
- Frontend: React + Vite + TypeScript
- Security/event persistence: Prisma-backed (`SecurityEvent`, `KeyRotationLog`, `Notification`, `SystemSecurityStatus`)
- Plugin/capability model: tenant-scoped feature flags and fail-closed middleware
- Offline/sync model: immutable receipt public ID + idempotent offline operation replay

## 3. Program Snapshot

| Phase | Status | Current Reality |
|---|---|---|
| Phase 0 | COMPLETE | API contracts and core route normalization are implemented. |
| Phase 1 | COMPLETE | Core inventory/sales domain logic and transaction boundaries are live. |
| Phase 2 | COMPLETE | Plugin registry, capability gating, tenant flags, and hook bus are implemented. |
| Phase 3 | PARTIAL | Vertical routes/models are implemented; workflow depth and E2E hardening still open. |
| Phase 4 | COMPLETE (API) | Payments/receipts/hardware APIs implemented; some real-world transport/hardware follow-through remains. |
| Phase 5 | COMPLETE (Core) | Sync/dead-letter/idempotency path is implemented; telemetry and conflict E2E depth remain hardening work. |
| Phase 6 | PARTIAL | Theme and checkout productivity UX progressed; accessibility/touch sign-off not complete. |
| Phase 7 | COMPLETE (API) | Role-scoped reporting + intelligence endpoints are implemented and integrated. |
| Phase 8 | PARTIAL | Security, backup drill, alert rules, and release gate scripts implemented; ops automation and policy enforcement still incomplete. |

## 4. Detailed As-Built by Phase

### Phase 0 - Stabilization and Contract Cleanup
Implemented:
- Inventory routes are implemented under `/api/inventory/*`.
- Payments route contract normalized to `/api/payments/process`.
- Sync contract normalized to `/api/sync/batch` and `/api/sync/status`.
- Major route registration consolidated in `backend/src/index.ts`.

Evidence:
- `backend/src/routes/inventory.ts`
- `backend/src/routes/payments.ts`
- `backend/src/routes/sync.ts`
- `backend/src/index.ts`

Remaining:
- Receipt email transport still has TODO implementation code path in payments route.

### Phase 1 - Core Domain Hardening
Implemented:
- Inventory transaction ledger and transaction types are in Prisma and route logic.
- Sales lifecycle endpoints exist (create/list/get/refund/return/void).
- Purchase flow and receiving flow endpoints exist.
- Tax/tax settings entities and settings routes exist.
- Core flows use `prisma.$transaction` in critical write paths.
- Audit routes and audit utility are implemented for traceability.

Evidence:
- `backend/prisma/schema.prisma`
- `backend/src/routes/sales.ts`
- `backend/src/routes/inventory.ts`
- `backend/src/routes/purchases.ts`
- `backend/src/routes/settings.ts`
- `backend/src/routes/audit.ts`
- `backend/src/utils/audit.ts`

Remaining:
- Some legacy route handlers still use permissive `any` casts and should be tightened over time.

### Phase 2 - Plugin Platform MVP
Implemented:
- Plugin data model (`Plugin`, `PluginCapability`, `PluginDependency`, `TenantFeatureFlag`).
- Capability fail-closed middleware (`requireCapability`, `requireAnyCapability`, `requireAllCapabilities`).
- Tenant feature-flag upsert and default profile capability mapping.
- Plugin admin routes for listing, tenant feature flags, and enable/disable operations.
- Core hook bus and hook emission in sales/receipt/sync paths.

Evidence:
- `backend/prisma/schema.prisma`
- `backend/src/middleware/capabilityMiddleware.ts`
- `backend/src/lib/pluginService.ts`
- `backend/src/routes/plugins.ts`
- `backend/src/lib/hookBus.ts`

Remaining:
- Plugin ecosystem governance (version policy, compatibility guarantees) is operationally defined but not fully automated.

### Phase 3 - Vertical Plugin Pack
Implemented:
- Expiry/lot models and APIs, including FEFO ordering and lot transfer endpoints.
- Restaurant table and kitchen ticket entities/routes.
- Pharmacy prescription/interaction/override entities/routes.
- Receiving session + discrepancy entities/routes.
- Frontend pages for `ExpiryLots`, `RestaurantTables`, `KitchenBoard`, `PharmacyConsole`, and `ReceivingCenter`.
- Capability-gated access for vertical features.

Evidence:
- `backend/src/routes/phase3.ts`
- `backend/prisma/schema.prisma`
- `frontend/src/pages/ExpiryLots.tsx`
- `frontend/src/pages/RestaurantTables.tsx`
- `frontend/src/pages/KitchenBoard.tsx`
- `frontend/src/pages/PharmacyConsole.tsx`
- `frontend/src/pages/ReceivingCenter.tsx`

Remaining:
- Workflow parity and deeper scenario coverage are still pending (especially high-contention and operational edge cases).
- Several vertical pages are functional but still console-style/minimal UX and need production polish.

### Phase 4 - Payments, Receipts, Hardware
Implemented:
- Multi-provider payment routing and settings-driven provider enable/disable.
- Dummy mode support for processors (safe placeholder processing).
- Payment/refund data model with idempotency key support.
- Receipt lookup by immutable public receipt ID.
- Hardware route surface for printers/scanners and test print workflow.

Evidence:
- `backend/src/routes/payments.ts`
- `backend/src/lib/payments/stripe.ts`
- `backend/src/lib/payments/square.ts`
- `backend/src/lib/payments/paypal.ts`
- `backend/src/routes/receipts.ts`
- `backend/src/routes/hardware.ts`
- `frontend/src/pages/settings/PaymentSettings.tsx`

Remaining:
- Email receipt transport TODO still present in backend.
- Physical printer/scanner execution remains environment/hardware dependent and not universally validated.

### Phase 5 - Offline and Sync Reliability
Implemented:
- Sync batch endpoint with deterministic operation ordering and duplicate handling.
- Dead-letter persistence, replay endpoint, retry/backoff policy.
- Sync status endpoint with dead-letter counters.
- Receipt public ID immutability in route and model flows.

Evidence:
- `backend/src/routes/sync.ts`
- `backend/src/routes/receipts.ts`
- `backend/prisma/schema.prisma`
- `frontend/src/components/SyncStatusModal.tsx`
- `frontend/src/service-worker.ts`
- `frontend/src/service-worker-optimized.ts`

Remaining:
- Operational telemetry depth and stress-tested multi-terminal conflict suites are still hardening items.

### Phase 6 - UX and Professional Polish
Implemented:
- Theme toggle and persistent theme behavior.
- Checkout-centric UI improvements and shortcut support.
- New reporting transaction pages and app routing updates.
- Responsive shell/navigation enhancements (including mobile menu behavior).

Evidence:
- `frontend/src/components/ThemeToggle.tsx`
- `frontend/src/pages/POSCheckout.tsx`
- `frontend/src/pages/SalesTransactions.tsx`
- `frontend/src/pages/PurchasesTransactions.tsx`
- `frontend/src/App.tsx`
- `frontend/src/styles.css`

Remaining:
- Formal WCAG 2.1 AA sign-off and full touch-target audit are not yet complete.

### Phase 7 - Reporting and Intelligence
Implemented:
- Role-scoped reporting visibility endpoints for sales and purchases.
- Intelligence endpoints for purchase recommendations and KPI packs.
- Frontend transaction reporting pages integrated in navigation.
- Authorization gates applied at route-level permissions.
- Broad reporting suite endpoints are implemented (sales summary, product/category analytics, revenue, inventory valuation/movement, low stock, customer analytics, payment methods, discounts impact, employee performance, margins, tax, hourly/daily, CSV export).

Evidence:
- `backend/src/routes/reports.ts`
- `backend/src/routes/reportingIntelligence.ts`
- `backend/src/lib/reportingIntelligence.ts`
- `frontend/src/pages/SalesTransactions.tsx`
- `frontend/src/pages/PurchasesTransactions.tsx`
- `frontend/src/App.tsx`

Remaining:
- Expanded regression depth and operational SLO instrumentation are still hardening items.

### Phase 8 - Security, Compliance, Ops
Implemented:
- Security status, events, and key rotation APIs.
- Backup drill APIs and non-production restore simulation route.
- Alert rules config + evaluation APIs and service logic.
- Security event and notification fanout persistence.
- Security settings UI integration.
- Release gate scripts for migration drift, pre-release evidence, and post-release evidence.
- Backup/restore runbook documentation.

Evidence:
- `backend/src/routes/security.ts`
- `backend/src/lib/securityCompliance.ts`
- `backend/src/lib/alertService.ts`
- `backend/src/lib/notificationService.ts`
- `backend/src/routes/health.ts`
- `backend/scripts/gate-migration-drift.js`
- `backend/scripts/gate-pre-release-evidence.js`
- `backend/scripts/gate-post-release-evidence.js`
- `backend/scripts/simulate-restore-drill.js`
- `docs/P8_BACKUP_RESTORE_RUNBOOK.md`
- `frontend/src/pages/settings/SecuritySettings.tsx`
- `frontend/src/lib/securityAPI.ts`

Remaining:
- Quarterly rotation enforcement is logged/procedural but not fully policy-automated.
- Release gate scripts exist but are not fully wired into all CI/CD pipelines.
- Environment-specific TLS profile/runbook depth can still be expanded.

## 5. Implemented Capability and Plugin Matrix

### Core implemented capability families
- Catalog and product management
- Inventory core + expiry/lot tracking
- Sales + checkout + returns/refunds
- Payments multi-provider
- Receipts and sync hooks
- Reporting and role-scoped intelligence
- Security posture/events/rotation/backup drills

### Vertical feature routes currently integrated
- Restaurant: tables + kitchen
- Pharmacy: prescription + interactions + override logging
- Receiving: session + discrepancy + completion flows
- Expiry/Lots: FEFO and near-expiry visibility

## 6. Security Implementation Map (Current Code Evidence)

### API surface
- `GET /api/security/status`
- `GET /api/security/events`
- `GET /api/security/key-rotations`
- `POST /api/security/rotate-keys`
- `GET /api/security/backup-drills`
- `POST /api/security/backup-drills/simulate-restore`
- `GET /api/security/alert-rules`
- `PUT /api/security/alert-rules`
- `POST /api/security/alert-rules/evaluate`

### Persistence
- `SecurityEvent`
- `KeyRotationLog`
- `Notification`
- `SystemSecurityStatus`

Evidence:
- `backend/src/routes/security.ts`
- `backend/prisma/schema.prisma`
- `backend/src/lib/securityCompliance.ts`
- `backend/src/lib/alertService.ts`
- `backend/src/lib/notificationService.ts`

## 7. Explicit Stubs, Placeholders, and Dev-Only Paths

### Unfinished implementation stubs
- Email receipt send logic TODO:
  - `backend/src/routes/payments.ts`
- Frontend security event logging transport TODO:
  - `frontend/src/lib/security.ts`
- Idempotency utility is still mostly placeholder behavior:
  - `backend/src/utils/idempotency.ts`
- Logger utility explicitly marked as stub implementation:
  - `backend/src/utils/logger.ts`

### Partially placeholder helper paths (module is otherwise functional)
- Coupon code validation path is still placeholder while core discount math is implemented:
  - `backend/src/utils/discountEngine.ts`
- Gift card validation path is still placeholder while core payment validation is implemented:
  - `backend/src/utils/paymentEngine.ts`

### Functional but minimal/operator-console style UI still needing polish
- `frontend/src/pages/PharmacyConsole.tsx`
- `frontend/src/pages/ReceivingCenter.tsx`
- `frontend/src/pages/KitchenBoard.tsx`

### Legacy thin route surfaces (functional, but still basic)
- `backend/src/routes/products.ts`
- `backend/src/routes/purchases.ts`

### Dev-only and controlled dummy behavior (intentional)
- Payment dummy mode in settings and backend processing paths:
  - `frontend/src/pages/settings/PaymentSettings.tsx`
  - `backend/src/routes/payments.ts`

## 8. Validation and Evidence Commands

Backend:
```bash
cd backend
npm run build
npm test
npx prisma migrate status
node scripts/gate-migration-drift.js
node scripts/gate-pre-release-evidence.js
node scripts/gate-post-release-evidence.js
npm run ops:simulate-restore-drill:latest
```

Frontend:
```bash
cd frontend
npm run build
npm test
```

## 9. Next Work Packets (Priority Order)

1. P8-C CI/CD integration hardening
- Wire migration/pre/post gate scripts into deployment pipeline.
- Fail closed on gate violations.

2. P6 accessibility completion
- Full WCAG 2.1 AA verification, touch target audit, and focus/contrast sign-off.

3. P3 workflow hardening
- Deep integration/E2E coverage for restaurant/pharmacy/receiving edge scenarios.

4. Payment completion
- Implement production email receipt delivery path and end-to-end validation.

5. Utility debt cleanup
- Replace placeholder idempotency/logger implementations with production-grade services.

## 10. Program Definition of Done (Updated)
- One codebase supports supermarket, restaurant, and pharmacy through capability/profile gating.
- Core commerce flows are stable online/offline with auditable state changes.
- Payments, inventory, sync, and security evidence paths are verifiable.
- Remaining open work is explicitly tracked in Section 7 and Section 9.
