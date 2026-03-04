# Aether POS - Agent Execution Master Plan

## 1. Purpose
This document is designed to be consumed by autonomous coding/review agents.
It defines a complete, execution-ordered roadmap to evolve Aether into a modular POS platform adaptable to:
- Supermarket
- Restaurant
- Pharmacy

The plan includes:
- Current-state constraints discovered in codebase scan
- Plugin enabler architecture
- Vertical profile model
- Phase-by-phase implementation steps
- Acceptance criteria per phase
- Dependency and risk controls
- Agent work packet templates

## 2. Current-State Facts (Verified)
The following constraints are verified from current repository code:
- Inventory routes are stubs: `backend/src/routes/inventory.ts`
- Payment pathing is inconsistent:
  - Backend defines `'/payments/process'` in `backend/src/routes/payments.ts`
  - Frontend calls `'/api/payments/process'` in `frontend/src/components/StripePaymentForm.tsx`
- Sync pathing is inconsistent:
  - Backend defines `'/sync/batch'` in `backend/src/routes/sync.ts`
  - Frontend calls `'/api/sync/batch'` in `frontend/src/lib/offline/sync.ts`
- Email receipt logic is TODO in `backend/src/routes/payments.ts`

Implication:
Stabilization and contract consistency must be completed before feature expansion.

## 3. Strategic Product Target
Build a layered POS platform:
1. Core Commerce Engine
2. Plugin Capability Layer
3. Vertical Profile Layer
4. Operational Excellence Layer

### 3.1 Core Commerce Engine
Mandatory, always-on capabilities:
- Auth + session lifecycle
- RBAC + permission log
- Product catalog + pricing
- Sales lifecycle (complete, void, return, refund)
- Inventory ledger (adjust, transfer, recount)
- Tax calculation engine
- Settings/config management
- Audit logging

### 3.2 Plugin Capability Layer
Dynamically enabled capabilities:
- Expiry and lot/batch tracking
- Loyalty and rewards
- Restaurant table/KDS workflows
- Pharmacy prescription controls
- Payment providers and terminal integrations
- Receipt channels (print/email/SMS)
- Procurement and supplier workflows
- Notifications

### 3.3 Vertical Profile Layer
Per-tenant profile bundles:
- `supermarket`
- `restaurant`
- `pharmacy`

Each profile toggles plugins and sets defaults.

### 3.4 Operational Excellence Layer
- Observability (logs, metrics, traces)
- Security hardening and secrets management
- Performance budgets and load tests
- Backup/restore and DR procedures
- CI/CD quality gates

## 4. Plugin Enabler Architecture

### 4.1 Data Model Additions
Add entities:
- `Plugin`
  - `id`, `name`, `version`, `status`, `entrypoint`, `checksum`, `createdAt`, `updatedAt`
- `PluginCapability`
  - `id`, `pluginId`, `capabilityKey`, `description`
- `Tenant`
  - `id`, `name`, `verticalProfile`, `timezone`, `currency`, `status`
- `TenantFeatureFlag`
  - `id`, `tenantId`, `capabilityKey`, `enabled`, `configJson`, `updatedBy`, `updatedAt`
- `PluginDependency`
  - `id`, `pluginId`, `dependsOnPlugin`, `versionConstraint`

### 4.2 Runtime Contracts
Required interfaces:

```ts
export interface PosPlugin {
  manifest: {
    name: string
    version: string
    capabilities: string[]
    dependencies?: Array<{ name: string; version: string }>
  }
  registerRoutes?: (app: unknown) => Promise<void>
  registerHooks?: (bus: HookBus) => Promise<void>
  registerUIExtensions?: (registry: UIExtensionRegistry) => Promise<void>
  healthCheck?: () => Promise<{ ok: boolean; detail?: string }>
}

export interface HookBus {
  emit: (event: string, payload: unknown) => Promise<void>
  on: (event: string, handler: (payload: unknown) => Promise<void>) => void
}
```

### 4.3 Policy Enforcement
Enforce capability checks at:
- API route guards
- Service layer commands
- UI menu/page registration

Rule:
A route or UI action tied to a capability must fail closed when disabled.

### 4.4 Event Taxonomy (Initial)
- `beforeSaleFinalize`
- `afterSaleFinalize`
- `beforeInventoryCommit`
- `afterInventoryCommit`
- `beforeRefund`
- `afterRefund`
- `onSyncConflict`
- `onReceiptRender`

## 5. Vertical Profile Matrix

| Capability | Supermarket | Restaurant | Pharmacy |
|---|---:|---:|---:|
| `catalog.basic` | On | On | On |
| `inventory.core` | On | On | On |
| `inventory.expiry` | Optional | Optional | On |
| `inventory.lot_tracking` | Optional | Off | On |
| `sales.quick_checkout` | On | Optional | Optional |
| `restaurant.table_service` | Off | On | Off |
| `restaurant.kds` | Off | On | Off |
| `pharmacy.prescription_validation` | Off | Off | On |
| `pharmacy.controlled_substances` | Off | Off | On |
| `promotions.advanced` | On | Optional | Optional |
| `loyalty.program` | On | On | Optional |
| `payments.multi_provider` | On | On | On |
| `receipts.print` | On | On | On |
| `receipts.email_sms` | Optional | Optional | Optional |

## 6. Phase Plan (Execution Order)

### Phase 0 - Stabilization and Contract Cleanup
Duration: 1-2 weeks

Tasks:
- Standardize API prefixes (`/api/...`) across backend + frontend.
- Fix payment and sync endpoint mismatches.
- Replace inventory stubs with functional implementations.
- Introduce unified API error format and code taxonomy.
- Add route-level request/response schema validation.

Acceptance Criteria:
- No route path mismatches between FE and BE.
- Inventory endpoints perform real reads/writes.
- Zero critical stub responses in production routes.
- Contract tests passing for auth, products, sales, inventory, sync, payments.

### Phase 1 - Core Domain Hardening
Duration: 2-3 weeks

Tasks:
- Implement robust inventory ledger behavior (adjust, transfer, recount).
- Complete sale state transitions (complete/void/return/refund).
- Replace hardcoded tax with configurable tax engine from settings.
- Enforce transaction boundaries for all stock and payment-impacting operations.

Acceptance Criteria:
- End-to-end sell/void/refund/return updates stock and logs correctly.
- Tax rules configurable and applied by scope.
- Concurrency-safe inventory commits.

### Phase 2 - Plugin Platform MVP
Duration: 2 weeks

Tasks:
- Add plugin registry tables and migration.
- Implement plugin loader and capability registry.
- Implement feature flag service with tenant scoping.
- Add capability middleware guards.
- Add admin UI for plugin/capability toggles.

Acceptance Criteria:
- Capability can be toggled per tenant without redeploy.
- Disabled capability blocks related routes and UI actions.
- Plugin dependency rules enforced.

### Phase 3 - Vertical Plugin Pack
Duration: 3 weeks

Tasks:
- Expiry/Lot plugin: FEFO logic, near-expiry alerts.
- Restaurant plugin: table states, ticket lifecycle, KDS queue.
- Pharmacy plugin: prescription validation and pharmacist override flow.
- Procurement plugin: supplier POs, receiving discrepancies.

Acceptance Criteria:
- Each vertical profile is runnable with profile-specific workflows.
- Profile switch changes available features without code changes.

### Phase 4 - Payments and Hardware
Duration: 2 weeks

Tasks:
- Complete processor parity (Stripe, Square, PayPal).
- Webhook reconciliation and idempotency keys.
- Printer/scanner/terminal abstraction plugin.
- Receipt renderer templates by profile.

Acceptance Criteria:
- Retry-safe payments without duplicate charging.
- Receipt print pipeline operational.
- Hardware APIs abstracted behind plugin contracts.

### Phase 5 - Offline and Sync Reliability
Duration: 2 weeks

Tasks:
- Fix sync contract and endpoint consistency.
- Add queue observability and dead-letter handling.
- Add deterministic conflict resolution policies.
- Add replay-safe operation IDs.

Acceptance Criteria:
- Offline operations sync deterministically.
- Conflicts are surfaced and resolvable with policy.

### Phase 6 - Product Polish and UX
Duration: 2 weeks

Tasks:
- Keyboard-first checkout workflow.
- Better loading/error/empty states.
- Role-aware navigation and dashboard personalization.
- Performance tuning (pagination, virtualization, caching).
- Accessibility baseline pass.

Acceptance Criteria:
- Cashier flow operable with keyboard and scanner-first usage.
- P95 critical screen load and action budgets met.

### Phase 7 - Reporting and Intelligence
Duration: 2 weeks

Tasks:
- Profile-aware dashboards and KPI packs.
- Drill-down reports and export pipelines.
- Operational analytics (shrinkage, expiry loss, payment failures).

Acceptance Criteria:
- Managers can answer top operational questions from dashboards without raw DB queries.

### Phase 8 - Security, Compliance, and Ops
Duration: 2 weeks

Tasks:
- Secret management and key rotation.
- Immutable audit policy and retention settings.
- Observability stack and alerts.
- Backup/restore runbooks and DR drills.
- CI/CD quality gates for tests and performance.

Acceptance Criteria:
- Production readiness checklist fully green.
- Recovery drill proves RTO/RPO targets.

## 7. Cross-Phase Dependency Rules
- Do not start Phase 2 before Phase 0 contract cleanup is complete.
- Do not enable vertical plugins before plugin capability middleware exists.
- Do not claim offline-ready status before sync conflict handling is proven.
- Do not launch pharmacy profile before prescription + controlled-substance guardrails are active.

## 8. Quality Gates (Global)
For every feature/phase increment, require:
- Unit tests for business logic
- Integration tests for route + DB behavior
- Contract tests for FE/BE payload compatibility
- E2E tests for critical operator flows
- Security checks for authz and input validation
- Observability hooks (logs + key metrics)

Minimum CI gates:
- `backend` tests pass
- `frontend` type checks pass
- Contract test suite pass
- No high-severity lint/type/build errors

## 9. Suggested Work Packet Format for Agents
Use this template for each autonomous agent task:

```md
# Work Packet: <Name>

## Goal
Single, measurable outcome.

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

## 10. Agent Prompt Snippets

### 10.1 Contract Alignment Agent
"Align frontend and backend route contracts to `/api/*`, update callers and handlers, add contract tests, and produce a diff summary."

### 10.2 Inventory Activation Agent
"Replace inventory stubs with production implementations using Prisma transactions for adjust/transfer/recount, add tests for negative stock prevention and low-stock query correctness."

### 10.3 Plugin Foundation Agent
"Add plugin registry schema and capability middleware, implement per-tenant feature flags and fail-closed route guards, include migration and seed updates."

### 10.4 Vertical Profile Agent
"Implement profile seeds (`supermarket`, `restaurant`, `pharmacy`) and capability matrices; enforce profile defaults in feature-flag bootstrapping."

## 11. Immediate Next 3 Execution Tickets
1. Contract normalization ticket: path consistency for payments and sync plus contract tests.
2. Inventory enablement ticket: remove stubs and implement full inventory flow.
3. Plugin core ticket: schema + loader + capability middleware + admin toggle UI.

## 12. Definition of Done (Program-Level)
The program is done when:
- One codebase can run all three verticals by profile + capability toggles.
- Critical commerce flows are stable online/offline.
- Payments, inventory, and audits are consistent and verifiable.
- Operational and security controls are production-grade.
- New vertical features can be added as plugins without core rewrites.
