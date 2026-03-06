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
- Plugin runtime contract is implemented (`registerRoutes`, `registerHooks`, `registerUIExtensions`, `healthCheck`)
- Event hook bus is operational for all core hooks in section 6.4
- Vertical profile seeds exist for supermarket, restaurant, and pharmacy

### Phase 3 - Vertical Plugin Pack (4-5 weeks)
Dependency gate:
- Phase 2 must be complete before Phase 3 starts (plugin registry, capability middleware, feature flags, and hook bus are required foundations).

#### Phase 3.1 - Expiry and Lot Plugin with FEFO (1-1.5 weeks)
Tasks:
- Add lot and expiry entities in Prisma (`LotBatch` or equivalent) and link them to `InventoryLocation` and `InventoryTransaction`
- Add inventory endpoints for lot creation, lot transfer, and expiring-soon reporting
- Implement FEFO allocation logic during stock deduction
- Add expiry and lot handling to receiving flows
- Add frontend inventory views for lot/expiry visibility and near-expiry alerts
- Add integration and E2E tests for FEFO selection and expiry alerts

Exit criteria:
- Inventory is tracked by lot and expiry where capability is enabled
- Checkout/inventory deduction uses FEFO consistently
- Expiring-soon data is exposed in API and visible in UI

#### Phase 3.2 - Restaurant Table and Kitchen Flow Plugin (1.5-2 weeks)
Tasks:
- Add restaurant entities (`RestaurantTable`, `RestaurantOrder`, `KitchenTicket`, modifier support)
- Implement table lifecycle and order state machine (`open -> preparing -> ready -> served -> closed`)
- Add backend routes for table operations and kitchen ticket queue updates
- Add real-time kitchen updates (WebSocket or polling contract)
- Add frontend pages for table management and kitchen display
- Add tests for table transitions, ticket routing, and kitchen completion flow

Exit criteria:
- Orders can be created and tracked by table
- Kitchen receives and updates ticket status in near real-time
- Restaurant workflow is fully role-gated and capability-gated

#### Phase 3.3 - Pharmacy Prescription and Controlled Substance Plugin (1-1.5 weeks)
Tasks:
- Add pharmacy entities (`Prescription`, `PrescriptionItem`, `DrugInteraction`, pharmacist override log)
- Extend product metadata for controlled-substance and prescription requirements
- Add prescription validation and fill endpoints
- Add interaction-check endpoint and enforcement hooks before sale finalization
- Add pharmacist verification/override flow in checkout UI
- Add tests for prescription validity, refill limits, controlled-substance checks, and override auditing

Exit criteria:
- Prescription-required sales are blocked without valid prescription
- Controlled-substance constraints are enforced and auditable
- Interaction warnings/blocks work as configured

#### Phase 3.4 - Procurement and Supplier Receiving Plugin (1 week)
Tasks:
- Extend purchase receiving with receiving sessions and discrepancy tracking
- Capture per-line lot/expiry data during receiving
- Add discrepancy resolution paths (short/over/damaged)
- Link receiving completion to inventory updates and audit logging
- Add UI for receiving workflow and discrepancy handling
- Add integration tests for receiving, variance, and lot assignment

Exit criteria:
- PO receiving supports lot/expiry assignment and discrepancy logging
- Inventory updates reflect receiving outcomes deterministically
- Receiving workflows are capability-gated and test-covered

#### Phase 3.5 - Profile Integration and Rollout Validation (0.5 week, parallel where possible)
Tasks:
- Wire supermarket, restaurant, and pharmacy profiles to tenant capability bundles
- Ensure all Phase 3 APIs/UI are fail-closed when capability disabled
- Add profile-specific smoke/E2E suites for critical workflows

Exit criteria:
- All 3 profiles run with profile-specific workflows
- Feature disablement blocks both API usage and UI entry points
- Profile test matrix passes in CI

### Phase 4 - Payments, Receipts, Hardware (2 weeks)
Status:
- Completed (implementation pass with dummy-provider mode and settings-driven controls)

Validation status note:
- `Test Print` endpoint and generated payload formatting are implemented and API-verified.
- Physical printer execution is currently marked `UNTESTED` because no connected printer hardware is available in the current environment.
- Final hardware validation is pending: paper feed, width clipping, character encoding, and vendor-specific driver behavior.

Tasks:
- Complete provider parity (Stripe/Square/PayPal)
- Idempotent payment operations + webhook reconciliation
- Receipt renderers (profile-aware)
- Printer/scanner abstractions

Implemented in this pass:
- Payment processor enable/disable flags in settings for Stripe, Square, and PayPal
- Dummy mode flags and safe dummy transaction flows for all three providers
- Provider gating in `/api/payments/process` (disabled providers fail closed)
- Expanded hardware APIs for printers/scanners and print test payload generation
- Printer design settings (paper width, logo toggle, header/footer, font style/size)
- Settings UI updates to manage processor toggles, dummy mode, hardware summary, and printer design

Exit criteria:
- Retry-safe payments
- Receipt print/email pipeline functional

### Phase 5 - Offline and Sync Reliability (2 weeks)
Objective:
- Make offline checkout and recovery deterministic across multiple terminals without changing printed receipt identity.

Architecture decisions (non-negotiable):
- Printed receipt ID is immutable and terminal-issued (`receiptPublicId`) and is the operator/customer reference.
- Backend sale primary key (`Sale.id`) remains internal and may only be attached later during sync.
- Printed receipt ID does NOT change after online sync. Only the mapping state changes from `pending` to `mapped`.

High-level data model additions:
- Backend `Sale` (or linked mapping table):
  - `receiptPublicId` (string, unique per tenant, indexed)
  - `terminalId` (string, indexed)
  - `offlineOpId` (string, unique idempotency key from terminal)
  - `syncState` (`online_created` | `offline_pending` | `offline_synced` | `offline_conflict`)
  - `clientCreatedAt` (datetime, for deterministic ordering)
- Backend `SyncDeadLetter`:
  - `id`, `tenantId`, `terminalId`, `offlineOpId`, `entityType`, `payload`, `errorCode`, `errorDetail`, `attemptCount`, `firstFailedAt`, `lastFailedAt`, `status` (`open` | `replayed` | `discarded`)
- Frontend IndexedDB (`pending_sales` / `sync_queue` extensions):
  - `receiptPublicId`, `terminalId`, `offlineOpId`, `baseVersion`, `logicalClock`, `syncAttempts`, `lastSyncError`

API scope (Phase 5):
- `POST /api/sync/batch`
  - Input: ordered operations with `offlineOpId`, `receiptPublicId`, `terminalId`, `clientCreatedAt`, `baseVersion`, payload
  - Output: per-operation result (`applied` | `duplicate` | `conflict` | `dead_lettered`) plus `saleId` mapping when available
- `GET /api/sync/status`
  - Returns queue/dead-letter counters by terminal and latest replay status for operator banner
- `GET /api/receipts/:receiptPublicId`
  - Always resolves by immutable printed ID and includes mapped `saleId` when synced
- `POST /api/sync/dead-letter/:id/replay`
  - Manual retry endpoint for supervisor/admin role

Multi-terminal offline strategy (collision prevention + deterministic reconciliation):
- Receipt identity generation:
  - `receiptPublicId = <terminalCode>-<businessDate>-<monotonicCounter>` assigned locally and printed immediately.
  - `terminalCode` is unique per device; counter is persisted locally and never reset mid-day.
- Operation identity:
  - `offlineOpId` is ULID/UUIDv7 generated per write operation and used as server idempotency key.
- Deterministic processing:
  - Server processes per terminal in ascending (`clientCreatedAt`, `offlineOpId`) order.
  - Cross-terminal inventory reconciliation uses optimistic version check (`baseVersion`) and deterministic tiebreak (`clientCreatedAt`, then lexicographic `offlineOpId`).
- Collision policy:
  - Duplicate `offlineOpId` -> return `duplicate` with existing mapping, no new write.
  - Conflicting stock mutation -> keep accepted write, mark rejected op as `conflict`, route to dead-letter with resolution metadata.

Conflict and dead-letter policy:
- Auto-resolvable conflicts:
  - Idempotent duplicate operations: auto-ack as `duplicate`.
  - Non-overlapping updates: server merge and mark `applied`.
- Manual-review conflicts:
  - Negative inventory risk, stale `baseVersion`, or deleted target entity.
  - Operation is moved to `SyncDeadLetter` after retry budget (for Phase 5: 5 attempts with exponential backoff).
- Operator visibility:
  - Terminal UI shows `Pending Sync`, `Conflict Needs Review`, and `Synced` counts.
  - Receipt lookup/reprint by `receiptPublicId` remains available regardless of sync state.

Must-have (2-week commitment):
- Implement immutable receipt/public ID mapping path (frontend + backend + reprint lookup).
- Implement `POST /api/sync/batch` idempotency using `offlineOpId`.
- Implement deterministic per-terminal ordering and version-based conflict detection.
- Implement dead-letter persistence and supervisor replay endpoint.
- Add operator sync banner, queue counters, and per-receipt sync badge in POS/history screens.
- Add tests:
  - Unit: idempotency + conflict classifier
  - Integration: batch sync apply/duplicate/conflict/dead-letter
  - E2E: offline sale print -> reconnect -> mapped sale retrieval by immutable `receiptPublicId`

Stretch (only if must-have is green):
- Pre-allocation window for receipt counters by business date rollover handling.
- Bulk dead-letter replay with dry-run preview.
- Sync telemetry dashboard widgets (p95 sync latency, conflict rate by terminal).

Acceptance criteria:
- Printed receipt ID remains unchanged before and after sync in API responses, UI history, and reprints.
- Replaying the same offline batch does not create duplicate sales/payments.
- Two terminals selling overlapping inventory offline reconcile deterministically with auditable conflict outcomes.
- Dead-lettered operations are queryable, replayable, and role-restricted.
- Operators can complete offline checkout, print receipts, and later locate synced sales using printed receipt ID only.

### Phase 6 - UX and Professional Polish (2 weeks)
Tasks:
- Checkout productivity UX (keyboard + touch parity):
  - Add a persistent shortcut cue panel inside the product-entry area (largest checkout box where products are shown).
  - Show shortcut hints for checkout and product entry when search is idle (examples: focus search, pay, clear cart, open discount, quantity adjust, void last sale where permitted).
  - Fade shortcut cue panel out as soon as product search input becomes non-empty; fade back in when search is cleared.
  - Ensure shortcuts are role-aware and fail-closed (hidden/disabled when action is unavailable).
  - Keep all checkout-critical actions accessible on touch devices without keyboard dependency.
- Touch-first checkout ergonomics:
  - Minimum interactive target size 44x44px (48x48 preferred) for product cards, cart quantity controls, and payment actions.
  - Tablet-first responsive layout for 768px-1366px POS devices and handheld fallback for narrow screens.
  - Improve spacing/visual hierarchy in cart and totals for quick tap accuracy under high-throughput cashier flow.
  - Ensure product-grid scrolling and cart interactions remain smooth on low-end touch hardware.
- Loading and error polish:
  - Skeleton states for product results and checkout panels (replace blank/flashy loading states).
  - Standardized actionable error blocks with retry paths and accessible live-region announcements.
  - Consistent success/failure feedback for discount/payment/void/refund actions.
- Theme and visual polish (light + dark):
  - Implement app-level theme mode toggle with persistence and initial system-preference hydration.
  - Add fully supported dark mode for checkout, cart, modals, and navigation.
  - Replace current red-biased generic accent with a more neutral commerce-safe accent palette in both modes (readable at WCAG contrast targets).
  - Remove hardcoded colors from virtualized/product rows and migrate to theme tokens.
- Role-aware workflow simplification:
  - Keep navigation and checkout controls scoped by role/capability; remove dead-end entry points.
  - Reduce decision friction for cashier flow by emphasizing primary next actions.
- Performance and accessibility baseline (WCAG 2.1 AA):
  - Maintain virtualization/pagination for heavy product lists.
  - Set practical UX performance budgets for interactive checkout (search-to-render and tap-to-feedback responsiveness).
  - Validate focus order, keyboard navigation, labels, and contrast in both light/dark modes.

Implementation tracks:
- Track A: Shortcut overlay and keyboard bindings in checkout product-entry panel.
- Track B: Touch-target and responsive layout hardening for checkout/cart/modals.
- Track C: Theme architecture and accent-token refresh (light/dark parity).
- Track D: Accessibility and feedback consistency pass.

Definition of done (Phase 6):
- Checkout shortcut cues are visible in the product-entry panel while idle and fade away immediately when typing search.
- Keyboard shortcuts accelerate checkout but all critical actions remain fully operable by touch.
- Dark mode is available, persisted, and visually consistent across the app shell and checkout flow.
- Accent colors are updated in both themes and meet contrast/readability requirements.
- Checkout UI is optimized for tablet/touch devices with no critical tap-target or overflow issues.
- Accessibility baseline checks pass for key checkout workflows.

Exit criteria:
- Operator checkout/product-entry workflows are faster and clearer on keyboard and touch.
- Search-driven shortcut cues behave exactly as specified (idle visible, active-search faded).
- Light/dark theme parity is production-ready with updated accent tokens.
- Performance and accessibility budgets pass for checkout-critical paths.

### Phase 7 - Reporting and Intelligence (2 weeks)
Objective:
- Deliver production-safe reporting and intelligence endpoints with strict role-based visibility and deterministic, explainable recommendation logic.

RBAC data-visibility rules (non-negotiable):
- `ADMIN`, `MANAGER`, `SUPERVISOR`:
  - Can access combined sales + purchase reporting and intelligence endpoints.
  - Can view sales detail across all operators in allowed date range.
  - Can view purchase recommendations and combined operational KPI packs.
- `CASHIER`:
  - Can access only role-scoped sales visibility (`own sales only`).
  - Cannot access purchase intelligence endpoints.
  - Cannot access cross-operator sales drill-down.
- `STOCK_CLERK`:
  - Can access purchase intelligence and stock-focused KPI packs.
  - Cannot access sales detail endpoints.
  - May only receive aggregate stock/supply metrics (no cashier-level sales detail payloads).
- Export hard gate:
  - Report export endpoints must require `reports.export` permission (role alone is insufficient).

Phase 7 API contract (backend):
- Existing reporting routes in `backend/src/routes/reports.ts` must be authenticated and permission-gated.
- `GET /api/reports/sales/visible`
  - Returns role-scoped sale list.
  - Response shape:
    - `{ scope: 'OWN_SALES_ONLY' | 'COMBINED_SALES', count: number, items: Sale[] }`
- `GET /api/reports/sales/:id/visible`
  - Returns one sale if visible under caller role scope.
  - Response shape:
    - `{ scope: 'OWN_SALE_ONLY' | 'COMBINED_SALE', sale: Sale }`
- `GET /api/reports/purchases/visible`
  - Returns role-scoped purchase order list.
  - Response shape:
    - `{ scope: 'OWN_PURCHASES_ONLY' | 'COMBINED_PURCHASES', count: number, items: PurchaseOrder[] }`
- `GET /api/reports/purchases/:id/visible`
  - Returns one purchase order if visible under caller role scope.
  - Response shape:
    - `{ scope: 'OWN_PURCHASE_ONLY' | 'COMBINED_PURCHASE', purchase: PurchaseOrder }`
- `GET /api/reports/intelligence/purchase-recommendations`
  - Returns deterministic recommendations with explainability metadata.
  - Response shape:
    - `{ scope: Role, generatedAt: ISODate, config: {...}, recommendations: Recommendation[] }`
- `GET /api/reports/intelligence/kpis`
  - Returns role-scoped KPI pack with formulas.
  - Response shape:
    - `{ meta: {...}, permissions: {...}, kpis: Array<{ key, label, value, formula }> }`

KPI packs by vertical (required formulas + output contract):
- Output contract (all verticals):
  - `meta.scope`, `meta.vertical`, `meta.from`, `meta.to`, `meta.unit`
  - `permissions.canViewSalesDetail`, `permissions.canViewPurchaseIntelligence`
  - `kpis[]` entries with explicit deterministic formula string
- Core KPIs (all combined roles):
  - Revenue: `sum(sale.totalCents)`
  - Transactions: `count(completed sales)`
  - Average Ticket: `Revenue / max(Transactions, 1)`
  - Gross Margin %: `((Revenue - EstimatedCOGS) / max(Revenue, 1)) * 100`
  - Purchase Spend: `sum(purchaseOrder.totalCents where status != CANCELLED)`
  - Low Stock SKU Count: `count(inventoryLocation where qty <= minThreshold)`
- Supermarket pack additions:
  - Basket Size: `sum(saleItem.qty) / max(count(completed sales), 1)`
- Restaurant pack additions:
  - Card Payment Share %: `(sum(card payment amount) / max(total revenue, 1)) * 100`
- Pharmacy pack additions:
  - Pharmacy Category Unit Mix %: `(sum(units where category contains 'pharma') / max(total units sold, 1)) * 100`
- Cashier pack restrictions:
  - `My Revenue`, `My Transactions`, `My Average Ticket` only (scoped to `sale.userId = currentUser`)
- Stock clerk pack restrictions:
  - `Low Stock SKUs`, `Total On-Hand Units`, `Purchase Spend`, `Stock Turnover` only

Purchase recommendation engine requirements (deterministic + explainable):
- Deterministic inputs:
  - `windowDays`, `leadTimeDays`, `serviceLevelDays`, inventory on-hand, reorder/min thresholds, sales units in window.
- Deterministic formula (required in payload):
  - `recommendedQty = max(ceil(dailyDemand*leadTimeDays) + max(ceil(dailyDemand*serviceLevelDays), reorderPoint-onHandQty, minThreshold) - onHandQty, 0)`
  - where `dailyDemand = unitsSoldWindow / windowDays`
- Explainability metadata (required per recommendation):
  - `model`, `inputs`, `formula`, `confidenceScore`, `confidenceReasons`
- Confidence rules must be static and inspectable (no stochastic/LLM behavior).
- Recommendation ordering must be deterministic (`priorityScore desc`, stable tie-break by product id where needed).

Testing requirements (integration + contract):
- RBAC tests must validate:
  - Cashier sees only own sales on `sales/visible`
  - Cashier denied on `purchases/visible`
  - Cashier denied on purchase recommendations
  - Manager/supervisor/admin can view combined purchase visibility endpoints
  - Stock clerk is scoped to own purchases on purchase visibility endpoints
  - Stock clerk denied on sales detail endpoints
  - Stock clerk allowed on purchase recommendations and stock KPI pack
  - Export endpoint denied without `reports.export`
- Contract tests must validate presence of:
  - `scope` fields for visibility endpoints
  - `meta/permissions/kpis[].formula` for KPI endpoint
  - `explainability.inputs/formula/confidence*` for recommendation endpoint

Rollout plan:
- Step 1: Deploy backend routes + RBAC guards dark-launched behind frontend usage toggle.
- Step 2: Enable dashboard calls for manager/supervisor/admin paths; monitor 403/500 rate and latency.
- Step 3: Enable stock-clerk KPI/recommendation tiles.
- Step 4: Enable cashier scoped sales visibility card.

Operational checks:
- Audit and permission-denial logs reviewed daily in first rollout week.
- Endpoint SLO targets:
  - P95 < 400ms for KPI endpoint on standard dataset.
  - P95 < 700ms for recommendations endpoint on standard dataset.

Exit criteria:
- RBAC behavior is test-covered and enforced for all new reporting/intelligence endpoints.
- CSV export is blocked unless `reports.export` is granted.
- KPI packs return role-scoped and vertical-scoped formula-bearing payloads.
- Recommendation endpoint returns deterministic recommendations with explainability metadata.
- Integration tests for Phase 7 reporting RBAC/intelligence pass in CI.

### Phase 8 - Security, Compliance, Ops (2 weeks)
Tasks:
- Secrets and key rotation execution
  - [x] Store application secrets only in environment secret providers (K8s Secret/CI vault), never in git.
  - [ ] Enforce quarterly rotation for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, DB credentials, and Redis credentials.
  - [x] Add `/api/security/key-rotations` query path to review rotation history by time and actor.
  - [x] Add `/api/security/rotate-keys` (ADMIN) for rotation logging workflow and operator notification fanout.
  - [x] Record `SecurityEvent(KEY_ROTATION)` for every success/failure path and retain actor/IP metadata.
- TLS posture hardening
  - [x] Configure `TLS_KEY_PATH`, `TLS_CERT_PATH`, and `TLS_CA_PATH` in all production runtime manifests.
  - [x] Ensure TLS certificate mounts are read-only in Docker/K8s workloads.
  - [x] Add ingress TLS manifest with cert-manager placeholders and strict redirect annotations.
  - [ ] Add non-dedicated-hosting TLS profile: reverse-proxy TLS termination (Nginx/Caddy) with internal backend over private network and forced HTTPS redirect.
  - [ ] Add dedicated-hosting TLS profile: managed cert rotation via cert-manager or cloud LB certificate manager.
  - [ ] Add LAN/no-public-domain fallback TLS profile for organizations using local DNS/IP with locally trusted certificate authority (CA) and installation guide.
  - [x] Surface TLS posture in `/api/security/status` and `/api/health` (`httpsEnforced`, `tlsConfigured`).
- Monitoring, alerting, and tracing
  - [x] Add `/api/health` dependency checks for postgres and redis with latency measurements.
  - [x] Emit security failure notifications to ADMIN and MANAGER recipients.
  - [x] Capture security event and key rotation streams via `/api/security/events` and `/api/security/key-rotations`.
  - [ ] Define alert thresholds: auth failure spikes, security status failures, expired cert metadata, and backup failures.
- Backup and restore readiness
  - [ ] Schedule daily encrypted DB backups and weekly restore simulation in non-prod.
  - [ ] Validate point-in-time restore runbook with explicit RPO/RTO targets.
  - [ ] Persist backup drill outcomes as security/ops events for audit traceability.
- Release gates and compliance controls
  - [x] CI gate: targeted security and health route tests must pass before deploy.
  - [ ] CI gate: migration status and schema drift check must be green.
  - [ ] Pre-release gate: latest `/api/health` status is `ok|degraded` with database check passing.
  - [ ] Pre-release gate: no unresolved CRITICAL security events in previous 24h.
  - [ ] Post-release gate: verify key rotation and security notification fanout are visible in notification history.
- Notification history and auditability
  - [x] Persist notification records per recipient for ADMIN and MANAGER audiences.
  - [x] Track read/archive lifecycle for security notifications in UI/API.
  - [x] Keep notification metadata fields (`component`, `status`, `error`) for incident reconstruction.
  - [x] Add Security Settings UI panel that shows TLS/HTTPS posture, key rotation history, security event stream, and notification history.

Exit criteria:
- Phase 8 checklist items above are all complete.
- Security, key rotation, and health endpoints are test-covered and passing in CI.
- Release gate evidence (backup drill, health checks, notification history) is attached to deployment records.

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
4. Phase 5 must-have: immutable `receiptPublicId` mapping + `GET /api/receipts/:receiptPublicId` lookup/reprint contract.
5. Phase 5 must-have: `POST /api/sync/batch` idempotency (`offlineOpId`) + deterministic multi-terminal ordering and conflict classification.
6. Phase 5 must-have: `SyncDeadLetter` persistence + supervisor replay endpoint + operator sync/conflict status surfaces.

## 15. Program Definition of Done
- One codebase runs supermarket, restaurant, and pharmacy via profile + capability toggles.
- Core commerce flows are stable online/offline.
- Payments, inventory, and audit logs are consistent and verifiable.
- Ops/security controls are production-grade.
- New vertical features can be added through plugins with minimal core rewrites.
