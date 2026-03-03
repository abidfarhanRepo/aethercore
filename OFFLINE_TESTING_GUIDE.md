# Offline Capability Testing Guide

## Test Environment Setup

### Prerequisites
- Chrome DevTools or Firefox Developer Tools
- Aether POS running locally
- Test data loaded (products, users, warehouses)

## Test Scenarios

### Test 1: Offline Detection

**Scenario**: Verify system correctly detects offline status

**Steps**:
1. Open Aether POS in chrome
2. DevTools → Network → Throttling → Offline
3. Observe OfflineIndicator in bottom right
4. Should show "Offline" with red indicator

**Expected Result**:
- OfflineIndicator visible with "Offline" text
- Network calls fail gracefully
- Console shows "[Offline] Network status: offline"

**Pass Criteria**: ✓ All above conditions met

---

### Test 2: Create Sale While Offline

**Scenario**: Create and save a sale when offline

**Steps**:
1. Go online, load products and inventory
2. Simulate offline (DevTools → Network → Offline)
3. Go to Checkout page
4. Add 2-3 products to cart
5. Complete checkout
6. Observe notification and pending sales

**Expected Result**:
- Sale saved to local IndexedDB
- OfflineIndicator shows "1 pending"
- Notification: "Sale saved offline"
- Sale appears in pending sales list
- Inventory updated locally

**Pass Criteria**: ✓ All above conditions met

---

### Test 3: Inventory Adjustment Offline

**Scenario**: Make inventory adjustments while offline

**Steps**:
1. Go online, load inventory
2. Simulate offline
3. Go to Inventory Management
4. Add stock adjustment (e.g., +10 units)
5. Save adjustment
6. Check pending adjustments

**Expected Result**:
- Adjustment saved locally
- OfflineIndicator shows pending count
- Adjustment queued for sync
- Local inventory updated

**Pass Criteria**: ✓ All above conditions met

---

### Test 4: Auto-Sync on Reconnection

**Scenario**: Verify automatic sync when going online

**Steps**:
1. Create 2-3 sales offline
2. OfflineIndicator shows "3 pending"
3. Go online (DevTools → Network → Online)
4. Wait 5 seconds
5. Observe sync progress

**Expected Result**:
- OfflineIndicator shows "Syncing..."
- Spinner animates during sync
- After completion: "0 pending" or shows failed count
- Server receives all sales
- Database updated on backend

**Pass Criteria**: ✓ All above conditions met

---

### Test 5: Manual Sync Trigger

**Scenario**: Manually trigger sync from SyncStatusModal

**Steps**:
1. Create 2 sales offline
2. Go online
3. Click OfflineIndicator
4. SyncStatusModal opens
5. Click "Sync Now" button
6. Monitor progress

**Expected Result**:
- Modal shows all pending items
- "Sync Now" button triggers sync
- Progress updates in real-time
- Items move from pending to success
- Modal updates after sync complete

**Pass Criteria**: ✓ All above conditions met

---

### Test 6: Failed Sync & Retry

**Scenario**: Handle sync failures and retry

**Prerequisites**: Set up invalid data to trigger validation error

**Steps**:
1. Create sale with negative quantity (invalid)
2. Go online
3. Sync happens, fails due to validation
4. Click OfflineIndicator to see status
5. Review error message
6. Click "Retry" button
7. Error persists (data still invalid)

**Expected Result**:
- Failed item shows red indicator
- Error message visible in modal
- "Retry" button available for failed items
- Clicking retry attempts sync again
- Invalid data continues to fail

**Pass Criteria**: ✓ All above conditions met

---

### Test 7: Clear Failed Items

**Scenario**: Clear all failed items from sync queue

**Steps**:
1. Create sale with invalid data
2. Force sync (online)
3. Item fails to sync
4. Open SyncStatusModal
5. Click "Clear Failed" button
6. Confirm dialog
7. Check queue is empty

**Expected Result**:
- Confirmation dialog appears
- Failed items removed from queue
- OfflineIndicator shows "0 pending"
- Operation irreversible (data lost)

**Pass Criteria**: ✓ All above conditions met

---

### Test 8: Batch Sync Multiple Types

**Scenario**: Sync multiple operation types in one batch

**Steps**:
1. Create 2 sales offline
2. Add inventory adjustment offline
3. Update product offline
4. Go online
5. Observe batch sync

**Expected Result**:
- All 4 items batched in single request
- Server receives batch
- Each operation processed individually
- Results returned with server IDs
- All items sync successfully

**Pass Criteria**: ✓ All above conditions met

---

### Test 9: Service Worker Caching

**Scenario**: Verify Service Worker caches assets

**Steps**:
1. DevTools → Application → Service Workers
2. Check registration status
3. DevTools → Application → Cache Storage
4. Go online, load page
5. Observe cache population

**Expected Result**:
- Service Worker registered and active
- Cache storage has multiple caches:
  - `aethercore-static-v1`
  - `aethercore-api-v1`
  - `aethercore-images-v1`
- CSS/JS/HTML cached after first load
- API responses cached

**Pass Criteria**: ✓ All above conditions met

---

### Test 10: Offline Page View

**Scenario**: Access cached pages while offline

**Steps**:
1. Load page online (caches assets)
2. Go offline (DevTools → Network → Offline)
3. Refresh page
4. Navigate to different route
5. Go back to previous route

**Expected Result**:
- Page loads from cache
- All CSS/JS still works
- Images display
- Navigation works
- No error messages
- Offline indicator visible

**Pass Criteria**: ✓ All above conditions met

---

### Test 11: Network Status Hook

**Scenario**: Verify useNetworkStatus hook works

**Steps**:
1. Create test component:
```tsx
function TestComponent() {
  const status = useNetworkStatus()
  return <div>Online: {status.isOnline ? 'Yes' : 'No'}</div>
}
```
2. Load component
3. Toggle offline/online in DevTools

**Expected Result**:
- Component shows correct status
- Updates immediately when toggling
- Status reflects actual network state

**Pass Criteria**: ✓ All above conditions met

---

### Test 12: IndexedDB Data Persistence

**Scenario**: Verify IndexedDB persists across sessions

**Steps**:
1. Create sale offline
2. Close Aether POS completely
3. Close all Chrome windows
4. Reopen Chrome and Aether POS
5. Check DevTools → Application → IndexedDB

**Expected Result**:
- Sales still in IndexedDB
- pending_sales store contains transaction
- Data survives application restart
- Can sync on next online reconnection

**Pass Criteria**: ✓ All above conditions met

---

### Test 13: Queue Priority Order

**Scenario**: High-priority items sync first

**Steps**:
1. Create inventory adjustment (priority 20)
2. Create sale (priority 10)
3. Create product (priority 0)
4. Go online
5. Monitor SyncStatusModal sync order

**Expected Result**:
- Inventory syncs first (priority 20)
- Sale syncs second (priority 10)
- Product syncs last (priority 0)
- Items processed in priority order

**Pass Criteria**: ✓ All above conditions met

---

### Test 14: Retry Backoff

**Scenario**: Verify exponential backoff on retries

**Prerequisites**: Mock API to simulate temporary failure

**Steps**:
1. Setup API to fail first 2 attempts
2. Create sale offline
3. Go online to trigger sync
4. Monitor console for retry logs
5. Check retry delays

**Expected Result**:
- First attempt: immediate (0s delay)
- Second attempt: ~1s delay
- Third attempt: ~2s delay
- Fourth attempt: ~4s delay
- Item syncs on succeeding attempt

**Pass Criteria**: ✓ All above conditions met

---

### Test 15: Concurrent Operations

**Scenario**: Handle multiple concurrent offline operations

**Steps**:
1. Create 5 sales offline rapidly
2. Add 3 inventory adjustments
3. Go online
4. Observe concurrent sync handling

**Expected Result**:
- All 8 items queued
- Batch includes all items
- All items process without errors
- UI remains responsive during sync
- All operations complete successfully

**Pass Criteria**: ✓ All above conditions met

---

## Edge Case Tests

### Edge Case 1: Network Flakiness

**Scenario**: Handle intermittent connectivity

**Steps**:
1. Go offline, create sale
2. Go online (partial sync)
3. Go offline again mid-sync
4. Go online
5. Verify no duplicates

**Expected Result**:
- Partial synced items not re-synced
- Failed items re-attempted
- No duplicate sales on backend
- Idempotency prevents double-charges

---

### Edge Case 2: Large Queue

**Scenario**: Handle large number of pending operations

**Steps**:
1. Create 50 sales offline
2. Go online
3. Monitor performance
4. Check memory usage

**Expected Result**:
- UI remains responsive
- Batch processes all 50 items
- No lag or timeout issues
- Memory usage reasonable

---

### Edge Case 3: Old Data Cleanup

**Scenario**: Automatic cleanup of old data

**Steps**:
1. Create sales 35 days ago (simulate)
2. Check IndexedDB size
3. Manually call `offlineDB.clearOldData(30)`
4. Check size again

**Expected Result**:
- Old data removed
- Recent data preserved
- Database size reduced

---

### Edge Case 4: Quota Exceeded

**Scenario**: Handle IndexedDB storage quota

**Steps**:
1. Fill IndexedDB to near quota
2. Try to add more sales
3. Observe behavior

**Expected Result**:
- System warns about storage
- Can still save if under quota
- User prompted to clear cache if full

---

## Performance Benchmarks

### Benchmark 1: Sync Speed

```
Target: < 5 seconds for 20 operations

Test:
1. Create 20 sales offline
2. Go online
3. Time from reconnect to completion
4. Should be < 5 seconds
```

### Benchmark 2: UI Responsiveness

```
Target: < 100ms for UI updates

Test:
1. Monitor sync progress updates
2. UI should update every 100-200ms
3. No jank or stuttering
```

### Benchmark 3: Memory Usage

```
Target: < 50MB for typical usage

Test:
1. Create 100 sales
2. Monitor memory in DevTools
3. Should not exceed 50MB
```

---

## Regression Testing Checklist

After each deploy, verify:

- [ ] OfflineIndicator displays correctly
- [ ] Sales can be created offline
- [ ] Auto-sync works on reconnection
- [ ] Service Worker still registered
- [ ] Cache still populated
- [ ] No console errors
- [ ] No memory leaks
- [ ] Sync queue persists correctly
- [ ] Failed items retry properly
- [ ] No duplicate syncs

---

## Test Data Factory

```typescript
// Create test sale data
function createTestSale() {
  return {
    items: [
      { productId: '1', quantity: 2, priceCents: 1000 },
      { productId: '2', quantity: 1, priceCents: 2500 },
    ],
    subtotalCents: 4500,
    taxCents: 450,
    totalCents: 4950,
    paymentMethod: 'cash',
    paymentStatus: 'pending'
  }
}

// Create test inventory adjustment
function createTestAdjustment() {
  return {
    productId: '1',
    type: 'in',
    quantity: 10,
    reason: 'Stock received',
    reference: 'PO123'
  }
}
```

---

## Automated Test Suite (Coming Soon)

Future implementation will include:
- Playwright tests for offline scenarios
- Cypress tests for UI interactions
- Jest unit tests for utility functions
- Performance profiling tests

---

## Support

For test failures:
1. Check console logs for errors
2. Verify test environment setup
3. Check internet connection
4. Clear browser cache and IndexedDB
5. Restart application and retry
6. Report issue with:
   - Test name and steps
   - Expected vs actual result
   - Console logs
   - Browser version
