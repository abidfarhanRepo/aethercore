# Aether POS Offline Capability - Implementation Guide

## Overview

This document describes the complete offline capability implementation for the Aether POS system. The system allows users to continue using the POS even without internet connectivity, with automatic syncing when the connection is restored.

## Architecture

### Frontend Components

#### 1. **IndexedDB Database (`lib/offline/db.ts`)**
- Stores products, inventory, users, and pending transactions
- Organized into 8 object stores:
  - `products`: Product catalog with versioning
  - `categories`: Product categories
  - `users`: User information
  - `inventory`: Inventory levels by warehouse
  - `pending_sales`: Sales transactions waiting to sync
  - `pending_adjustments`: Inventory adjustments waiting to sync
  - `sync_queue`: Operations queued for sync
  - `sync_history`: History of sync attempts

**Key Features:**
- Data versioning for cache invalidation
- Expiration-based cleanup (30 days old data)
- Size tracking and management
- Full CRUD operations for each store

#### 2. **Network Monitoring (`lib/offline/network.ts`)**
- Monitors online/offline status using `navigator.onLine`
- Performs periodic connectivity checks to `/api/health`
- Emits events on connectivity changes
- Estimates sync time based on queue size
- Provides subscription mechanism for status updates

**Key Features:**
- Real-time network status tracking
- 30-second periodic connectivity validation
- 5-second ping timeout
- Event listeners for connection changes
- Automatic sync triggering on reconnection

#### 3. **Sync Engine (`lib/offline/sync.ts`)**
- Manages the sync queue with priority-based operation ordering
- Implements exponential backoff retry logic (max 3 retries)
- Batches operations for efficient uploads
- Supports single-item fallback if batch fails
- Tracks sync progress and history

**Key Features:**
- Priority queue (payments sync first)
- Exponential backoff: 1s, 2s, 4s (max 30s)
- Request deduplication
- Conflict logging for manual review
- Sync progress notifications
- Operation status tracking (pending/syncing/success/failed)

#### 4. **Service Worker (`service-worker.ts`)**
- Caches static assets (HTML, CSS, JS, images)
- Implements Network First strategy for HTML and APIs
- Cache First strategy for static assets
- Handles offline requests gracefully
- Manages cache versioning

**Caching Strategies:**
- **HTML**: Network First with fallback to cache
- **APIs**: Network First with offline data fallback
- **Static Assets**: Cache First then network fallback
- **Images**: Cache First with placeholder fallback

#### 5. **React Hooks (`lib/hooks/useOffline.ts`)**
- `useNetworkStatus()`: Monitor connection status
- `useSyncProgress()`: Track sync progress
- `useOfflineAPI()`: Make offline-aware API calls
- `usePendingSales()`: Manage local sales
- `useOfflineInventory()`: Manage local inventory adjustments

#### 6. **UI Components**

**OfflineIndicator.tsx:**
- Shows online/offline status with indicator
- Displays pending operation count
- Shows sync progress during synchronization
- Provides quick access to sync modal
- Only displays when offline or has pending operations

**SyncStatusModal.tsx:**
- Displays all pending operations with status
- Shows success/failure breakdown
- Allows filtering by status (all/pending/failed)
- Manual sync button
- Retry failed operations
- Clear failed/all operations

### Backend Components

#### 1. **Sync Routes (`backend/src/routes/sync.ts`)**

**POST /api/sync/batch**
- Accepts array of offline operations
- Processes operations sequentially for transaction safety
- Supports: POST, PUT, DELETE operations
- Returns results with server-generated IDs
- Supports endpoints:
  - `/api/sales`: Create sales
  - `/api/inventory/adjust`: Adjust inventory
  - `/api/products`: Create/update products
  - Refund/return operations

**GET /api/sync/status**
- Returns sync capability information
- Lists supported endpoints
- Provides max batch size limits

#### 2. **Idempotency Service (`backend/src/utils/idempotency.ts`)**
- Tracks processed operations by ID
- Ensures duplicate requests return same result
- Enables safe retries
- Prevents duplicate charges/sales

### Data Sync Flow

```
1. User goes offline
   ↓
2. Operations are queued locally in IndexedDB
   ↓
3. App shows offline indicator
   ↓
4. Network connection restored
   ↓
5. Sync engine detects connection
   ↓
6. Batches pending operations
   ↓
7. Sends to /api/sync/batch endpoint
   ↓
8. Backend processes operations
   ↓
9. Returns results with server IDs
   ↓
10. Frontend updates local DB
    ↓
11. Clears from sync queue
    ↓
12. Updates UI with results
```

## Usage Examples

### Making Offline-Aware API Calls

```typescript
import { useOfflineAPI } from '../lib/hooks/useOffline'

function MyComponent() {
  const { isOnline, post } = useOfflineAPI()

  const handleSale = async (saleData) => {
    const result = await post('/api/sales', saleData, 10) // priority 10

    if (result.offline && result.queued) {
      console.log('Sale queued for sync:', result.queueId)
    } else {
      console.log('Sale processed:', result.data)
    }
  }

  return (
    <div>
      Status: {isOnline ? 'Online' : 'Offline'}
      <button onClick={() => handleSale({...})}>Create Sale</button>
    </div>
  )
}
```

### Saving Local Sales While Offline

```typescript
import { usePendingSales } from '../lib/hooks/useOffline'

function CheckoutComponent() {
  const { sales, saveSale, deleteSale } = usePendingSales()

  const handleCheckout = async (cartItems) => {
    const sale = await saveSale({
      items: cartItems,
      totalCents: 5000,
      paymentMethod: 'cash'
    })
    console.log('Sale saved locally:', sale.id)
  }

  return (
    <div>
      {sales.map(sale => (
        <div key={sale.id}>
          Due: ${(sale.totalCents / 100).toFixed(2)}
          <button onClick={() => deleteSale(sale.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

### Manual Sync Control

```typescript
import { syncEngine } from '../lib/offline/sync'

// Manually trigger sync
await syncEngine.sync()

// Get sync progress
const progress = await syncEngine.getProgress()
console.log(`${progress.completed}/${progress.total} synced`)

// Retry a specific failed item
await syncEngine.retryItem(itemId)

// Clear failed items
await syncEngine.clearFailed()

// Subscribe to progress updates
const unsubscribe = syncEngine.onProgress(progress => {
  console.log('Sync progress:', progress)
})
```

## Testing Scenarios

### 1. Start Offline - Create Sale - Go Online - Sync

```
1. Close Chrome DevTools Network tab (simulates offline)
2. Create a sale (should save locally)
3. Check OfflineIndicator shows "1 pending"
4. Close DevTools or enable network
5. Sale should auto-sync
6. Indicator updates to "0 pending"
```

### 2. Go Offline Mid-Transaction

```
1. Start checkout with multiple items
2. Disable network before completing
3. Still able to complete sale locally
4. Sale appears in pending
5. Re-enable network
6. Auto-sync triggers
7. Verify sale on backend
```

### 3. Partial Sync Failure

```
1. Queue 3 operations while offline
2. Simulate network: only 2 succeed, 1 fails
3. Check SyncStatusModal for failed operation
4. Click Retry on failed item
5. Should re-sync successfully
```

### 4. Cache Invalidation

```
1. Load products while online
2. Product added by another user on server
3. Go offline and back online
4. Update cache version in code
5. Verify new product appears
```

### 5. Offline Indicator Functionality

```
1. Go offline: indicator shows "Offline"
2. Create operations: indicator shows count
3. Click indicator: opens SyncStatusModal
4. Click Sync Now: starts sync
5. Goes online: auto-sync triggers
6. All clear: indicator disappears
```

## Configuration

### Sync Engine Options

```typescript
const syncEngine = new SyncEngine({
  maxRetries: 3,           // Number of retry attempts
  backoffMultiplier: 2,    // Exponential backoff multiplier
  maxBackoffDelay: 30000,  // Max delay between retries (30s)
})
```

### Network Monitor Options

- `PING_ENDPOINT`: '/api/health' (health check endpoint)
- `CHECK_INTERVAL`: 30000ms (how often to check connectivity)
- `PING_TIMEOUT`: 5000ms (timeout for health check)

### Service Worker Cache Strategy

- Static cache: `aethercore-static-v1`
- API cache: `aethercore-api-v1`
- Images cache: `aethercore-images-v1`

## Performance Considerations

### Batch Size
- Max batch size: 100 operations
- Recommended: 50-100 for optimal performance
- Larger batches reduce network requests but increase timeout risk

### IndexedDB Management
- Auto-cleanup: 30-day old data removed
- Size tracking: `getDBSize()` returns approximate size
- Monitor with: `offlineDB.getDBSize()`

### Sync Priority
- Payments: Priority 50 (sync first)
- Sales: Priority 10 (sync early)
- Inventory: Priority 20 (medium priority)
- Products: Priority 0 (sync when time allows)

## Conflict Resolution

### Server Wins Approach
- For inventory: Server values are authoritative
- Updates from offline client are rejected if server has newer version
- Logged for manual review in sync history

### Local Data Kept
- For user-created transactions (sales, refunds)
- If server rejects for validation reasons
- Error logged with reason

### 3-Way Merge (Future)
- For complex scenarios with multiple edits
- Compares: last synced, client version, server version
- Applies non-conflicting changes

## Error Handling

### Network Errors
- Automatically queued for later sync
- User can see in SyncStatusModal
- Can manually retry

### Validation Errors
- Backend returns 400 with validation errors
- Marked as failed (won't auto-retry)
- User sees error in SyncStatusModal
- Can edit and retry

### Server Errors (5xx)
- Automatically retried with exponential backoff
- Max 3 retries with delays: 1s, 2s, 4s
- After max retries, marked as failed

## Security Considerations

1. **Network Requests**: Batched requests use same auth headers as individual requests
2. **Local Storage**: IndexedDB data is not encrypted (use HTTPS in production)
3. **Sensitive Data**: Don't store passwords or sensitive tokens in IndexedDB
4. **Data Validation**: Backend validates all offline-queued operations
5. **Idempotency**: Prevents duplicate charges through operation ID tracking

## Monitoring and Debugging

### Console Logs
- Enable in DevTools to see detailed logs:
  - `[Offline]`: Offline mode initialization
  - `[Service Worker]`: Service worker events
  - `[SyncEngine]`: Sync operations
  - `[Network]`: Network status changes

### Dev Tools
- Open IndexedDB in Application tab to inspect stores
- Check Service Worker registration and cache in Application tab
- Monitor Network tab for batch sync requests

### Debug Functions
```typescript
// Check database size
const size = await offlineDB.getDBSize()
console.log(`DB Size: ${(size / 1024).toFixed(2)}KB`)

// List all pending operations
const queue = await syncEngine.getQueue()
console.log('Queue:', queue)

// Get current network status
const status = networkMonitor.getStatus()
console.log('Status:', status)
```

## Migration Path

### Existing Components
1. Import `useOfflineAPI` hook
2. Replace `api.post()` with `offlineAPI.post()`
3. Handle `offline` and `queued` response fields
4. Show user feedback for queued operations

### Example Migration
```typescript
// Before
const response = await api.post('/api/sales', saleData)

// After
const { offlineAPI } = createOfflineAPI()
const response = await offlineAPI.post('/api/sales', saleData)

if (response.offline && response.queued) {
  showNotification('Sale queued for sync')
}
```

## Future Enhancements

1. **Delta Sync**: Only sync changed fields
2. **Compression**: Gzip batch requests for smaller payloads
3. **Worker Threads**: Process sync in background thread
4. **Analytics**: Track offline vs online usage patterns
5. **Encryption**: Encrypt sensitive IndexedDB data
6. **Cloud Sync**: Sync to cloud backup during offline periods
7. **Offline Reports**: Generate reports from cached data

## Files Summary

| File | Purpose |
|------|---------|
| `frontend/src/lib/offline/db.ts` | IndexedDB wrapper |
| `frontend/src/lib/offline/sync.ts` | Sync engine |
| `frontend/src/lib/offline/network.ts` | Network monitoring |
| `frontend/src/service-worker.ts` | Service Worker |
| `frontend/src/components/OfflineIndicator.tsx` | Offline status indicator |
| `frontend/src/components/SyncStatusModal.tsx` | Sync management UI |
| `frontend/src/lib/hooks/useOffline.ts` | React hooks |
| `backend/src/routes/sync.ts` | Sync endpoints |
| `backend/src/utils/idempotency.ts` | Idempotency tracking |

## Support and Debugging

For issues:
1. Check console logs for error messages
2. Inspect IndexedDB data in DevTools
3. Review network requests in Network tab
4. Check SyncStatusModal for queued operations
5. Manually trigger sync to retry failed items
6. Clear cache if data corruption suspected

## Compliance

- GDPR: Users can clear all local data via Clear button
- CCPA: Local data removed with browser cache clear
- Data Privacy: No personal data sent to 3rd parties
- Offline Security: Uses HTTPS in production for sync
