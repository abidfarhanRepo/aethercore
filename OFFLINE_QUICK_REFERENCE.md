# Offline Capability - Quick Reference Guide

## 🚀 5-Minute Onboarding

### 1. Understand the System
- **Offline Detection**: App automatically detects when user goes offline
- **Operation Queuing**: All API calls queue locally if offline
- **Auto-Sync**: When online, operations automatically sync to backend
- **UI Feedback**: OfflineIndicator shows status, SyncStatusModal shows details

### 2. Check It's Working
```typescript
// In your component
import { useNetworkStatus } from '@/lib/hooks/useOffline'

function MyComponent() {
  const status = useNetworkStatus()
  return <div>You are {status.isOnline ? 'online' : 'offline'}</div>
}
```

### 3. Make Offline-Aware API Call
```typescript
import { useOfflineAPI } from '@/lib/hooks/useOffline'

function CheckoutComponent() {
  const { isOnline, post } = useOfflineAPI()

  const handleCreateSale = async (saleData) => {
    const result = await post('/api/sales', saleData, 10) // priority 10

    if (result.offline && result.queued) {
      alert('Sale queued for sync!')
    } else if (result.data) {
      alert('Sale created: ' + result.data.id)
    }
  }

  return <button onClick={() => handleCreateSale(data)}>Create Sale</button>
}
```

## 📦 What's Included

### Frontend Libraries
| File | Purpose | Key Export |
|------|---------|------------|
| `lib/offline/db.ts` | IndexedDB wrapper | `offlineDB` |
| `lib/offline/sync.ts` | Sync engine | `syncEngine` |
| `lib/offline/network.ts` | Network detection | `networkMonitor` |
| `service-worker.ts` | Asset caching | (auto-registered) |
| `lib/hooks/useOffline.ts` | React hooks | 5 hooks |

### Backend Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sync/batch` | Process offline operations |
| GET | `/api/sync/status` | Check sync capability |

### Components
| Component | Purpose |
|-----------|---------|
| OfflineIndicator | Shows status + pending count |
| SyncStatusModal | Manage sync queue |

## 🎯 Common Tasks

### Task: Check Network Status
```typescript
import { networkMonitor } from '@/lib/offline/network'

const status = networkMonitor.getStatus()
console.log('Online:', status.isOnline)
console.log('Last checked:', new Date(status.lastCheckedAt))
```

### Task: Monitor Sync Progress
```typescript
import { syncEngine } from '@/lib/offline/sync'

const unsubscribe = syncEngine.onProgress((progress) => {
  console.log(`${progress.completed}/${progress.total} synced`)
  console.log(`Failed: ${progress.failed}`)
})

// Later: stop listening
unsubscribe()
```

### Task: Manually Trigger Sync
```typescript
import { syncEngine } from '@/lib/offline/sync'

await syncEngine.sync()
console.log('Sync complete!')
```

### Task: Save Local Data While Offline
```typescript
import { offlineDB } from '@/lib/offline/db'

// Save a sale locally
const sale = {
  id: 'sale-123',
  userId: 'user-1',
  items: [{productId: 'p1', quantity: 2, priceCents: 5000}],
  totalCents: 10000,
  createdAt: Date.now(),
  paymentStatus: 'pending'
}

await offlineDB.savePendingSale(sale)

// Retrieve later
const savedSales = await offlineDB.getAllPendingSales()
console.log('Saved sales:', savedSales)
```

### Task: Retry Failed Operation
```typescript
import { syncEngine } from '@/lib/offline/sync'

// Get queue to find failed items
const queue = await syncEngine.getQueue()
const failedItems = queue.filter(item => item.status === 'failed')

// Retry first failed item
if (failedItems.length > 0) {
  await syncEngine.retryItem(failedItems[0].id)
}
```

### Task: Clear Pending Operations
```typescript
import { syncEngine } from '@/lib/offline/sync'

// Get current queue
const progress = await syncEngine.getProgress()
console.log(`${progress.total} operations pending`)

// Remove all failed operations
const cleared = await syncEngine.clearFailed()
console.log(`Cleared ${cleared} failed operations`)

// Remove all operations
await syncEngine.clearQueue()
console.log('Queue cleared')
```

## 🧪 Testing Offline Mode

### Simulate Offline in Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Find "Throttling" dropdown (usually shows "No throttling")
4. Select "Offline"
5. Perform your operations
6. App should queue them locally

### Check IndexedDB Data
1. DevTools → Application tab
2. Left sidebar → Storage → IndexedDB
3. Find "aethercore-pos" database
4. Inspect any of 8 stores:
   - products
   - inventory
   - pending_sales
   - sync_queue
   - sync_history

### Check Service Worker
1. DevTools → Application tab
2. Left sidebar → Service Workers
3. Should see "Service Worker registered"
4. Click "offline" to test offline mode

### Check Cache Storage
1. DevTools → Application tab
2. Left sidebar → Storage → Cache Storage
3. Three caches should exist:
   - `aethercore-static-v1`
   - `aethercore-api-v1`
   - `aethercore-images-v1`

## 🔌 Integration Points

### In Checkout Component
```typescript
function Checkout() {
  const { post } = useOfflineAPI()
  const { saveSale } = usePendingSales()
  const { isOnline } = useNetworkStatus()

  const handleCheckout = async (items) => {
    const saleData = {
      items,
      totalCents: calculateTotal(items),
      paymentMethod: 'cash'
    }

    if (!isOnline) {
      // Save offline
      const sale = await saveSale(saleData)
      showNotification(`Sale saved offline: ${sale.id}`)
    } else {
      // Send to server
      const result = await post('/api/sales', saleData, 10)
      if (result.offline && result.queued) {
        showNotification('Sale queued (network issue)')
      } else {
        showNotification('Sale completed')
      }
    }
  }

  return <CheckoutForm onComplete={handleCheckout} />
}
```

### In Inventory Component
```typescript
function InventoryAdjustment() {
  const { useOfflineInventory } = useOfflineInventory()
  const { post } = useOfflineAPI()

  const handleAdjust = async (productId, qty, reason) => {
    // Save locally
    await addAdjustment({
      productId,
      quantity: qty,
      reason,
      type: 'in'
    })

    // Queue for sync
    await post('/api/inventory/adjust', {
      productId,
      quantity: qty,
      reason
    }, 20) // priority 20
  }

  return <AdjustmentForm onAdjust={handleAdjust} />
}
```

## 📊 Monitoring

### Enable Debug Logging
Operations automatically log with prefixes:
- `[Offline]` - Offline system initialization
- `[Service Worker]` - Service Worker events
- `[SyncEngine]` - Sync operations
- `[Network]` - Network status changes

### Check Console
```typescript
// All these call console.log automatically:
networkMonitor.listen((status) => {}) // logs connection changes
syncEngine.onProgress((progress) => {}) // logs sync progress
```

### Get Diagnostic Info
```typescript
// Network status
console.log(networkMonitor.getStatus())

// Sync progress
console.log(await syncEngine.getProgress())

// Full queue
console.log(await syncEngine.getQueue())

// Database size
console.log(await offlineDB.getDBSize())
```

## ⚠️ Error Handling

### Network Errors
Automatically queued for retry. Check SyncStatusModal.

### Validation Errors
Marked as failed. Review error in SyncStatusModal, fix, and retry.

### Storage Quota
If IndexedDB quota exceeded, clear old data:
```typescript
// Clear data older than 30 days
await offlineDB.clearOldData(30)
```

## 🔑 Key Concepts

### Priority Levels
- **50**: Payments (sync immediately)
- **20**: Inventory (high priority)
- **10**: Sales (normal priority)
- **0**: Products/Settings (low priority)

### Queue Status Values
- **pending**: Waiting to sync
- **syncing**: Currently being synced
- **success**: Successfully synced
- **failed**: Sync failed (needs retry)

### Retry Strategy
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay
- Max: 3 retries (fails after)

## 🎯 Best Practices

1. **Always wrap user-facing API calls with offline handling**
   ```typescript
   const { post } = useOfflineAPI()
   const result = await post(url, data)
   if (result.queued) showMessage('Operation queued')
   ```

2. **Show network status in sensitive operations**
   ```typescript
   const { isOnline } = useNetworkStatus()
   if (!isOnline) warn('Work offline - will sync when online')
   ```

3. **Monitor sync progress for user feedback**
   ```typescript
   const progress = useSyncProgress()
   return <div>Syncing: {progress?.completed}/{progress?.total}</div>
   ```

4. **Clean up old data periodically**
   ```typescript
   // Called periodically
   await offlineDB.clearOldData(30)
   ```

5. **Log errors for debugging**
   ```typescript
   syncEngine.onProgress((progress) => {
     if (progress.failed > 0) {
       console.warn('Sync failures detected')
     }
   })
   ```

## 📞 API Response Format

### Offline Response
```javascript
{
  offline: true,
  queued: true,
  queueId: 'op-123-abc',
  data: undefined
}
```

### Online Response
```javascript
{
  offline: false,
  queued: false,
  data: {
    id: 'sale-123',
    totalCents: 5000,
    ...
  }
}
```

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Indicator not showing | Ensure OfflineIndicator added to App.tsx |
| No sync happening | Check `/api/sync/batch` endpoint responds |
| Data not persisting | Check IndexedDB enabled in DevTools |
| SW not registering | Clear cache, hard reload, check vite.config.ts |
| Operations not queuing | Check networkMonitor.isConnected() returns false |
| Batch sync fails | Check `/api/sync/batch` accepts array of operations |

## 📚 Related Files

- Implementation Guide: [OFFLINE_IMPLEMENTATION_GUIDE.md](../OFFLINE_IMPLEMENTATION_GUIDE.md)
- Testing Guide: [OFFLINE_TESTING_GUIDE.md](../OFFLINE_TESTING_GUIDE.md)
- Architecture: [OFFLINE_ARCHITECTURE.md](../OFFLINE_ARCHITECTURE.md)
- Example Component: [OfflineAwarePOSCheckout.example.tsx](../frontend/src/components/OfflineAwarePOSCheckout.example.tsx)

---

**Need help?** Check console for `[Offline]` logs, review IndexedDB in DevTools, or see the full implementation guide.
