# Aether POS - Unified Agent Execution Plan

## 1. Purpose
This file merges:
- `AGENT_EXECUTION_MASTER_PLAN.md` (repo-validated, execution-safe)
- `COMPREHENSIVE_FEATURE_PLAN.md` (broad feature depth)

Goal:
Provide one agent-ready plan that is both ambitious and grounded in the current codebase.

## 2. Similarity Review (What overlaps)
Both plans strongly align on:
- Multi-industry adaptability (supermarket, restaurant, pharmacy)
- Plugin/feature-toggle architecture
- Core modules: auth, products, sales, inventory, customers, reports
- Production polish: performance, accessibility, offline, observability
- Stepwise phased execution

## 3. What was accepted from the comprehensive plan
High-value additions adopted:
- Rich plugin catalog by vertical and cross-industry add-ons
- Concrete business profile defaults
- Feature matrix by industry
- Detailed module-level requirements (sales/inventory/customer/reporting)
- Testing checklist structure (unit/integration/E2E)
- UI polish checklist (loading, errors, shortcuts, a11y)
- Deployment checklist and monitoring expectations

## 4. What was NOT adopted as-is
Rejected or adapted items due to architecture mismatch:
- Next.js 15 + React 19 + API routes assumptions
- App Router folder structure under `src/app/...`
- SQLite dev default recommendation

Current repo baseline is:
- Backend: Fastify + Prisma
- Frontend: React + Vite + TypeScript
- Existing route and schema patterns must be extended, not replaced wholesale

## 5. Current-State Constraints (Must fix first)
Verified blockers from repo:
- Inventory routes are stubbed in `backend/src/routes/inventory.ts`
- Payment route prefix mismatch:
  - backend uses `/payments/process`
  - frontend calls `/api/payments/process`
- Sync route prefix mismatch:
  - backend uses `/sync/batch`
  - frontend calls `/api/sync/batch`
- Email receipt path has TODO implementation

Rule:
No new plugin work starts until API contract and inventory foundations are stable.

## 6. Unified Architecture Direction

### 6.1 Layers
1. Core Commerce Engine
2. Plugin Capability Layer
3. Vertical Profile Layer
4. Ops and Reliability Layer

### 6.2 Plugin Registry Model
Add/extend entities:
- `Plugin`
- `PluginCapability`
- `Tenant`
- `TenantFeatureFlag`
- `PluginDependency`

### 6.3 Plugin Runtime Contract
```ts
export interface PosPlugin {
  manifest: {
    name: string
    version: string
    capabilities: string[]
    dependencies?: Array<{ name: string; version: string }>
    conflicts?: string[]
  }
  onInstall?: () => Promise<void>
  onEnable?: () => Promise<void>
  onDisable?: () => Promise<void>
  onConfigChange?: (cfg: unknown) => Promise<void>
  registerRoutes?: (app: unknown) => Promise<void>
  registerHooks?: (bus: HookBus) => Promise<void>
  registerUIExtensions?: (registry: UIExtensionRegistry) => Promise<void>
  healthCheck?: () => Promise<{ ok: boolean; detail?: string }>
}
```

### 6.4 Event Hooks (initial)
- `beforeSaleFinalize`
- `afterSaleFinalize`
- `beforeInventoryCommit`
- `afterInventoryCommit`
- `beforeRefund`
- `afterRefund`
- `onSyncConflict`
- `onReceiptRender`

## 7. Vertical Capability Matrix (Merged)

| Capability | Supermarket | Restaurant | Pharmacy |
|---|---:|---:|---:|
| `catalog.basic` | On | On | On |
| `inventory.core` | On | On | On |
| `inventory.expiry` | On | Optional | On |
| `inventory.lot_tracking` | Optional | Off | On |
| `sales.quick_checkout` | On | Optional | Optional |
| `restaurant.table_service` | Off | On | Off |
| `restaurant.kds` | Off | On | Off |
| `restaurant.menu_modifiers` | Off | On | Off |
| `pharmacy.prescription_validation` | Off | Off | On |
| `pharmacy.controlled_substances` | Off | Off | On |
| `pharmacy.drug_interactions` | Off | Off | On |
| `promotions.advanced` | On | Optional | Optional |
| `loyalty.program` | On | On | Optional |
| `payments.multi_provider` | On | On | On |
| `receipts.print` | On | On | On |
| `receipts.email_sms` | Optional | Optional | Optional |

## 8. Plugin Catalog (Merged)

### 8.1 Core Plugins
- `core-auth`
- `core-products`
- `core-sales`
- `core-inventory`
- `core-users`
- `core-reports`
- `core-customers`

### 8.2 Supermarket Plugins
- `supermarket-barcode`
- `supermarket-weighing`
- `supermarket-expiry`
- `supermarket-promotions`
- `supermarket-self-checkout`

### 8.3 Restaurant Plugins
- `restaurant-tables`
- `restaurant-kitchen`
- `restaurant-menu`
- `restaurant-orders`
- `restaurant-recipes`

### 8.4 Pharmacy Plugins
- `pharmacy-prescriptions`
- `pharmacy-expiry`
- `pharmacy-controlled`
- `pharmacy-interactions`
- `pharmacy-insurance`

### 8.5 Cross-Industry Add-ons
- `addon-loyalty`
- `addon-delivery`
- `addon-accounting`
- `addon-warehouse`
- `addon-forecasting`

## 9. Phase Plan (Unified, execution-safe)

### Phase 0 - Stabilization and Contract Cleanup (1-2 weeks)
Tasks:
- Standardize route prefixes to `/api/*`
- Fix payment and sync endpoint mismatches
- Replace inventory stubs with real implementations
- Introduce uniform API error schema and response codes
- Add API contract tests for critical routes

Exit criteria:
- FE/BE route compatibility is green
- Inventory endpoints are functional and tested
- No critical stub responses in prod paths

### Phase 1 - Core Domain Hardening (2-3 weeks)
Tasks:
- Inventory ledger correctness (adjust/transfer/recount)
- Sales state machine (complete/void/return/refund)
- Tax rules from settings (remove hardcoded assumptions)
- Strong transaction boundaries and concurrency controls

Exit criteria:
- Sell/void/refund/return all reconcile inventory and audit
- Tax is configuration-driven and test-covered

### Phase 2 - Plugin Platform MVP (2 weeks)
Tasks:
- Plugin registry schema and migrations
- Capability middleware (fail-closed)
- Tenant-scoped feature flags
- Plugin admin UI (enable/disable/config)
- Dependency/conflict validation

Exit criteria:
- Per-tenant feature toggles work without redeploy
- Disabled capability blocks both API and UI usage

### Phase 3 - Vertical Plugin Pack (3 weeks)
Tasks:
- Expiry/lot plugin with FEFO behavior
- Restaurant table + kitchen flow plugin
- Pharmacy prescription + controlled substance controls
- Procurement/supplier receiving plugin

Exit criteria:
- All 3 profiles run with profile-specific workflows

### Phase 4 - Payments, Receipts, Hardware (2 weeks)
Tasks:
- Complete provider parity (Stripe/Square/PayPal)
- Idempotent payment operations + webhook reconciliation
- Receipt renderers (profile-aware)
- Printer/scanner abstractions

Exit criteria:
- Retry-safe payments
- Receipt print/email pipeline functional

### Phase 5 - Offline and Sync Reliability (2 weeks)
Tasks:
- Sync endpoint contract normalization
- Conflict policy engine + dead-letter queue
- Replay-safe operation IDs
- Sync telemetry and operator status surfaces

Exit criteria:
- Offline queue sync is deterministic and recoverable

### Phase 6 - UX and Professional Polish (2 weeks)
Tasks:
- Keyboard-first checkout
- Loading skeletons + robust error states
- Role-aware navigation and workflow simplification
- Pagination/virtualization/perf budgets
- Accessibility baseline (WCAG 2.1 AA)

Exit criteria:
- Operator flows are fast and consistent
- Performance and accessibility budgets pass

### Phase 7 - Reporting and Intelligence (2 weeks)
Tasks:
- KPI packs by vertical
- Drill-down analytics and exports
- Operational insights (shrinkage, expiry, payment failures)

Exit criteria:
- Managers can answer core operational questions from dashboards

### Phase 8 - Security, Compliance, Ops (2 weeks)
Tasks:
- Secrets management and key rotation
- Immutable audit retention policy
- Monitoring, alerting, tracing
- Backup/restore drills and release gates

Exit criteria:
- Production readiness checklist fully green

## 10. Core Module Requirements (Merged)

### 10.1 Auth and RBAC
- JWT access + refresh
- Brute-force protection
- Role + permission matrix
- Audit events for auth and permission changes

### 10.2 Products
- SKU/barcode uniqueness
- Category/subcategory
- Multi-price support where needed
- Search, import/export

### 10.3 Sales and Checkout
- Cart, split payment, discounts
- Receipt generation and reprint
- Void, partial/full refunds, returns
- Loyalty earn/redeem hooks

### 10.4 Inventory
- Multi-warehouse stock by location
- Transfer and recount sessions
- Expiry and lot extensions via plugin
- Low stock and exception alerts

### 10.5 Customers and Loyalty
- Customer profile and segmentation
- Loyalty point ledger
- Optional gift/store credit support

### 10.6 Reports
- Sales summary, product/category performance
- Inventory valuation and movement
- Employee and payment method performance

## 11. Testing and Quality Gates (Merged)
Each phase increment requires:
- Unit tests for business logic
- Integration tests for route + DB behavior
- Contract tests FE/BE payload compatibility
- E2E tests for operator-critical paths
- Security checks for authz/input validation

Suggested critical E2E scenarios:
- Complete sale with discount and split payment
- Return and refund with inventory restoration
- Offline sale queue and sync recovery
- Capability-disabled route denies action

## 12. Professional Polish Checklist (Merged)
- Skeleton loaders for heavy views
- Clear actionable error states
- Toast notifications with context
- Keyboard shortcuts for POS-critical actions
- Accessibility checks (contrast, focus, labels, keyboard nav)
- Responsive behavior for tablet POS usage

## 13. Agent Work Packet Template
```md
# Work Packet: <Name>

## Goal
Single measurable outcome.

## Scope
- Included:
- Excluded:

## Inputs
- Files:
- APIs:
- DB tables:

## Required Changes
1.
2.
3.

## Acceptance Criteria
- [ ]
- [ ]

## Validation
- Commands:
- Tests:

## Risks
-

## Rollback Plan
-
```

## 14. Immediate Next Tickets
1. Route contract normalization (`/api/*`) + contract tests.
2. Inventory route activation (replace stubs) + integration tests.
3. Plugin foundation (schema + loader + capability middleware + admin toggles).

## 15. Program Definition of Done
- One codebase runs supermarket, restaurant, and pharmacy via profile + capability toggles.
- Core commerce flows are stable online/offline.
- Payments, inventory, and audit logs are consistent and verifiable.
- Ops/security controls are production-grade.
- New vertical features can be added through plugins with minimal core rewrites.
