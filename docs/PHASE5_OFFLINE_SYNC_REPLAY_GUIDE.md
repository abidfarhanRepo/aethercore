# Phase 5 Offline Sync and Replay Guide

## Purpose
This document explains how offline sales, sync, dead-letter handling, and replay currently work in Aether POS.

## Core Principles
- Printed receipt identity is immutable.
- `receiptPublicId` is the customer/operator-facing ID and never changes after print.
- Backend `Sale.id` is internal and may be mapped after reconnect/sync.
- Offline writes are idempotent using `offlineOpId`.

## End-to-End Flow
1. Terminal creates a sale payload in checkout.
2. Frontend generates:
   - `terminalId`
   - `offlineOpId`
   - `receiptPublicId`
   - `clientCreatedAt`
3. If offline (or retryable network failure), sale is queued in the sync queue.
4. Sync engine sends queued operations to `POST /api/sync/batch`.
5. Backend processes in deterministic order:
   - grouped by terminal
   - terminals processed in lexicographic order
   - within terminal: `clientCreatedAt`, then `offlineOpId`
6. Backend returns per-operation status:
   - `created`
   - `duplicate`
   - `conflict`
   - `dead_lettered`
   - `error`
7. Frontend updates queue state and shows operator status in sidebar + modal.

## Idempotency
- `offlineOpId` is unique and stored on `Sale.offlineOpId`.
- If the same `offlineOpId` is replayed, backend returns existing sale mapping as `duplicate`.
- This prevents duplicate sale creation after reconnect retries.

## Dead-Letter Handling
### What goes to dead-letter
- Unsupported operations/endpoints.
- Sync failures that cannot be applied immediately.
- Conflict-classified errors that need operator intervention.

### Storage
Dead-letter entries are stored in `SyncDeadLetter` with:
- operation metadata
- error details
- attempt count
- status (`open`, `replayed`, `discarded`)
- timestamps (`createdAt`, `lastFailedAt`, `resolvedAt`)

### APIs
- `GET /api/sync/dead-letter`: list unresolved (`open`) items
- `POST /api/sync/dead-letter/:id/replay`: replay one item

## Replay Behavior
### Replay budget
- Maximum replay attempts are enforced server-side (`MAX_REPLAY_ATTEMPTS = 5`).
- If attempt budget is exceeded, item is marked `discarded` and replay is rejected.

### Exponential backoff (server-enforced)
Replay attempts are throttled with exponential backoff using `attemptCount` and `lastFailedAt`.

Current policy:
- base delay: 5 seconds
- formula: `delay = min(300, 5 * 2^(attemptCount - 1))`
- cap: 300 seconds

If replay is attempted before cooldown expires:
- backend returns `429` with `code = REPLAY_BACKOFF_ACTIVE`
- response includes `retryAfterSeconds` and `nextAllowedAt`

## Why backoff was not fully enforced before
Before this update, replay had:
- manual replay endpoint
- retry budget limit

But it did not have server-side cooldown checks. That meant operators could trigger replay repeatedly without waiting. The frontend had retry logic, but backend replay throttling was missing.

This guide corresponds to the server-side fix that now enforces cooldown on replay attempts.

## Operator Notes
- Use sidebar sync indicator (under role badge) to monitor online/offline and pending sync count.
- Open Sync Status modal to:
  - inspect queue
  - view dead-letter items
  - replay eligible dead-letter operations
- If replay returns `REPLAY_BACKOFF_ACTIVE`, wait until `nextAllowedAt`.
- If replay returns `RETRY_BUDGET_EXCEEDED`, escalate and review the payload manually.

## Validation Checklist
- Printed receipt keeps same `receiptPublicId` before and after sync.
- Duplicate `offlineOpId` does not create duplicate sales.
- `GET /api/sync/dead-letter` returns unresolved items.
- Replay endpoint returns:
  - `200` on success
  - `429 REPLAY_BACKOFF_ACTIVE` during cooldown
  - `409 RETRY_BUDGET_EXCEEDED` when attempts are exhausted
