# Offline Capability Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AETHER POS SYSTEM                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    FRONTEND (Browser)                        │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │           React Application                         │   │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │   │ │
│  │  │  │  Components (POSCheckout, ProductMgmt, etc.)   │ │   │ │
│  │  │  │  ├─ useNetworkStatus()                         │ │   │ │
│  │  │  │  ├─ useSyncProgress()                          │ │   │ │
│  │  │  │  ├─ useOfflineAPI()                            │ │   │ │
│  │  │  │  ├─ usePendingSales()                          │ │   │ │
│  │  │  │  └─ useOfflineInventory()                      │ │   │ │
│  │  │  └─────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │   │ │
│  │  │  │  UI Components                                  │ │   │ │
│  │  │  │  ├─ OfflineIndicator.tsx                       │ │   │ │
│  │  │  │  └─ SyncStatusModal.tsx                        │ │   │ │
│  │  │  └─────────────────────────────────────────────────┘ │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                          ▲                                   │ │
│  │                          │ (uses)                            │ │
│  │                          ▼                                   │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │          Offline Library Stack                        │ │ │
│  │  ├────────────────────────────────────────────────────────┤ │ │
│  │  │                                                        │ │ │
│  │  │  ┌─────────────────────────────────────────────────┐  │ │ │
│  │  │  │  API Wrapper (lib/api.ts)                       │  │ │ │
│  │  │  │  ├─ createOfflineAPI()                          │  │ │ │
│  │  │  │  ├─ Request deduplication                       │  │ │ │
│  │  │  │  └─ Cache before making API call                │  │ │ │
│  │  │  └─────────────────────────────────────────────────┘  │ │ │
│  │  │           ▲              ▲              ▲              │ │ │
│  │  │           │              │              │              │ │ │
│  │  │     ┌─────┴──┐    ┌──────┴─────┐  ┌────┴──────┐      │ │ │
│  │  │     │        │    │            │  │           │      │ │ │
│  │  │  ┌──▼──┐  ┌──────────┐  ┌──────────────┐  ┌──▼──┐   │ │ │
│  │  │  │     │  │          │  │              │  │     │   │ │ │
│  │  │  │  Network        Sync          IndexedDB│ Cache    │ │ │
│  │  │  │ Monitor (1)    Engine (2)      (3)    │         │ │ │
│  │  │  │  Detects   Batches & Queues  Local    │ Storage  │ │ │
│  │  │  │ online/    Retries with      Database │          │ │ │
│  │  │  │offline    Exponential       Products  │ Static   │ │ │
│  │  │  │status     Backoff           Sales     │ Assets   │ │ │
│  │  │  │ Pings    Priority Queue     Inventory │          │ │ │
│  │  │  │  API     Conflict Logic     Adjusts   │          │ │ │
│  │  │  │           Sync History      Queue     │          │ │ │
│  │  │  │           Progress Tracking History   │          │ │ │
│  │  │  │                                       │          │ │ │
│  │  │  └──┬──┘  └──────────┬────────┘  └──────┬──────┘  └──┬──┘ │
│  │  │     │                │                 │         │    │ │ │
│  │  │     └────────────────┼─────────────────┼─────────┘    │ │ │
│  │  │                      │                 │              │ │ │
│  │  └──────────────────────┼─────────────────┼──────────────┘ │ │
│  │                         │                 │                │ │
│  │  ┌──────────────────────┼─────────────────┼──────────────┐ │ │
│  │  │    Service Worker (4)│                 │              │ │ │
│  │  ├──────────────────────┼─────────────────┼──────────────┤ │ │
│  │  │                      ▼                 ▼              │ │ │
│  │  │  Cache Static Assets    Queue API Requests           │ │ │
│  │  │  ├─ HTML                ├─ POST /api/sales           │ │ │
│  │  │  ├─ CSS                 ├─ PUT /api/products         │ │ │
│  │  │  ├─ JS                  ├─ POST /api/inventory       │ │ │
│  │  │  └─ Images              └─ DELETE operations         │ │ │
│  │  │                                                       │ │ │
│  │  │  Network First: HTML & APIs                          │ │ │
│  │  │  Cache First: Static assets                          │ │ │
│  │  │  Fallback: Offline placeholders                      │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  │                          │                                  │ │
│  │                          │ (via fetch)                      │ │
│  │                          ▼                                  │ │
│  └──────────────────────────┼──────────────────────────────────┘ │
│                             │                                    │
│                             │ Network                            │
│                             │ (HTTP/HTTPS)                       │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐ │
│  │                    BACKEND (Node.js)                        │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │             Fastify API Server                       │   │ │
│  │  ├──────────────────────────────────────────────────────┤   │ │
│  │  │                                                      │   │ │
│  │  │  ┌──────────────────────────────────────────────┐   │   │ │
│  │  │  │  Sync Routes (routes/sync.ts)               │   │   │ │
│  │  │  │  ├─ POST /api/sync/batch                    │   │   │ │
│  │  │  │  │  ├─ Validate operations                  │   │   │ │
│  │  │  │  │  ├─ Process in transaction                │   │   │ │
│  │  │  │  │  ├─ Return server IDs                     │   │   │ │
│  │  │  │  │  └─ Log conflicts                         │   │   │ │
│  │  │  │  └─ GET /api/sync/status                     │   │   │ │
│  │  │  │     └─ Return capability info                │   │   │ │
│  │  │  └──────────────────────────────────────────────┘   │   │ │
│  │  │                     ▲                                │   │ │
│  │  │                     │                                │   │ │
│  │  │  ┌──────────────────┼───────────────────────────┐   │   │ │
│  │  │  │                  │                           │   │   │ │
│  │  │  │ ┌────────────────────────────────────────┐  │   │   │ │
│  │  │  │ │ Existing Routes (sales, inventory, etc)│  │   │   │ │
│  │  │  │ │ ├─ POST /api/sales (create)            │  │   │   │ │
│  │  │  │ │ ├─ POST /api/inventory/adjust          │  │   │   │ │
│  │  │  │ │ ├─ POST /api/products                  │  │   │   │ │
│  │  │  │ │ └─ PUT /api/products/:id               │  │   │   │ │
│  │  │  │ └────────────────────────────────────────┘  │   │   │ │
│  │  │  │                                             │   │   │ │
│  │  │  │ ┌────────────────────────────────────────┐  │   │   │ │
│  │  │  │ │ Idempotency Service (utils/idempotency)  │   │   │ │
│  │  │  │ │ ├─ Track operation IDs                 │  │   │   │ │
│  │  │  │ │ ├─ Prevent duplicates                  │  │   │   │ │
│  │  │  │ │ └─ Idempotent retries                  │  │   │   │ │
│  │  │  │ └────────────────────────────────────────┘  │   │   │ │
│  │  │  │                                             │   │   │ │
│  │  │  │ ┌────────────────────────────────────────┐  │   │   │ │
│  │  │  │ │ Conflict Resolution Logic              │  │   │   │ │
│  │  │  │ │ ├─ Server wins for inventory           │  │   │   │ │
│  │  │  │ │ ├─ Client data for transactions        │  │   │   │ │
│  │  │  │ │ ├─ Log conflicts                       │  │   │   │ │
│  │  │  │ │ └─ 3-way merge (future)                │  │   │   │ │
│  │  │  │ └────────────────────────────────────────┘  │   │   │ │
│  │  │  │                                             │   │   │ │
│  │  │  └─────────────────────────────────────────────┘   │   │ │
│  │  │                                                      │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                          │                                  │ │
│  │                          ▼                                  │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │               Database (PostgreSQL)                 │   │ │
│  │  ├──────────────────────────────────────────────────────┤   │ │
│  │  │  ├─ Products (with version)                         │   │ │
│  │  │  ├─ Sales (transactions)                            │   │ │
│  │  │  ├─ Inventory (levels & history)                    │   │ │
│  │  │  ├─ Users                                           │   │ │
│  │  │  ├─ Sync History (for debugging)                    │   │ │
│  │  │  └─ Audit Logs (for compliance)                     │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Scenario 1: Online Operation

```
User Action (Create Sale)
        │
        ▼
  React Component
        │
        ▼
  useOfflineAPI.post()
        │
        ▼
  networkMonitor.isConnected() ──────┐
        │                            │
        │ (true - online)            │
        ▼                            │
  Axios API Call                     │
        │                            │
        ▼                            │
  GET Request with auth              │
        │                            │
        ▼                            │
  Backend Route Handler              │
        │                            │
        ▼                            │
  Prisma DB Operation                │
        │                            │
        ▼                            │
  Response with Server ID            │
        │                            │
        ▼                            │
  Update React State                 │
        │                            │
        ▼                            │
  User Sees Confirmation              │
                                     │
                          (false - offline)
                                     │
                                     ▼
                            Check IndexedDB Cache
```

### Scenario 2: Offline Operation

```
User Action (Create Sale)
        │
        ▼
  React Component
        │
        ▼
  useOfflineAPI.post()
        │
        ▼
  networkMonitor.isConnected() ──────┐
        │                            │
        │ (false - offline)          │
        └────────────────────────────┤
                                     │
                                     ▼
                            syncEngine.queueOperation()
                                     │
                                     ▼
                            Create SyncQueueItem
                            ├─ id
                            ├─ type: 'POST'
                            ├─ endpoint: '/api/sales'
                            ├─ data: { items, total... }
                            ├─ status: 'pending'
                            └─ timestamp
                                     │
                                     ▼
                            offlineDB.addToQueue()
                                     │
                                     ▼
                            IndexedDB.put(item)
                                     │
                                     ▼
                            Update Local Inventory
                            (offlineDB.saveInventoryLevel)
                                     │
                                     ▼
                            Return { offline: true, queued: true }
                                     │
                                     ▼
                            User Sees "Saved Offline"
                                     │
                                     ▼
                            OfflineIndicator Updates
                            (shows pending count)
```

### Scenario 3: Auto-Sync on Reconnection

```
Network Restored
        │
        ▼
  networkMonitor.listen() triggers
        │
        ▼
  console.log('[Network] Connection restored')
        │
        ▼
  Notify event listeners
        │
        │
        ├──────────────────────────┐       ┌────────────────────┐
        │                          │       │                    │
        ▼                          ▼       ▼                    ▼
   OfflineIndicator      useSyncProgress  Components     syncEngine.sync()
   Updates status        Updates progress  Update            │
                                             UI               ▼
                                                    syncEngine.performSync()
                                                             │
                                                             ▼
                                                    Get pending items
                                                             │
                                                             ▼
                                                    Sort by priority
                                                             │
                                                             ▼
                                                    Group by endpoint
                                                             │
                                                             ▼
                                                    POST /api/sync/batch
                                                             │
                                                             ▼
                                                    Backend: validateOps
                                                             │
                                                             ▼
                                                    Backend: processOps
                                                             │
                                                             ▼
                                                    Backend: returnResults
                                                             │
                                                             ▼
                                                    Frontend: updateQueueStatus
                                                             │
                                                             ▼
                                                    Frontend: updateLocalDB
                                                             │
                                                             ▼
                                                    Clear from queue
                                                             │
                                                             ▼
                                                    Notify listeners
                                                             │
                                                             ▼
                                                    OfflineIndicator: hidden
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────┐
│                    Main App                                 │
│  ┌────────────┐           ┌──────────────────────────────┐  │
│  │            │           │ Layout Component            │  │
│  │ App.tsx    │           │ ├─ Sidebar                  │  │
│  │            │           │ ├─ Routes                   │  │
│  │ ├─ Routes  │──────────▶│ ├─ OfflineIndicator    ◄────┼──┘
│  │ ├─ Auth    │           │ └─ SyncStatusModal    ◄────┼─┐
│  │ └─ Layout  │           └──────────────────────────────┘ │
│  └────────────┘                      ▲                     │
│         │                            │                     │
│         │ (renders)                  │ (props)             │
│         ▼                            │                     │
│  ┌──────────────────────────────────┼────────────────┐    │
│  │    Pages                         │                │    │
│  │  ┌────────────────────────────┐  │                │    │
│  │  │ POSCheckout Page           │  │                │    │
│  │  │ ├─ Cart Component          │  │                │    │
│  │  │ ├─ Products List           │  │                │    │
│  │  │ ├─ useNetworkStatus()    ◄───┤                │    │
│  │  │ ├─ usePendingSales()     ◄───┤                │    │
│  │  │ └─ useOfflineAPI()       ◄───┤                │    │
│  │  └────────────────────────────┘  │                │    │
│  │                                   │                │    │
│  │  ┌────────────────────────────┐  │                │    │
│  │  │ Inventory Management       │  │                │    │
│  │  │ ├─ useOfflineInventory() ◄────┤                │    │
│  │  │ └─ Adjustments List        │  │                │    │
│  │  └────────────────────────────┘  │                │    │
│  │                                   │                │    │
│  │  ┌────────────────────────────┐  │                │    │
│  │  │ Product Management         │  │                │    │
│  │  │ ├─ useOfflineAPI()       ◄────┤                │    │
│  │  │ └─ Product Editor         │  │                │    │
│  │  └────────────────────────────┘  │                │    │
│  └──────────────────────────────────┼────────────────┘    │
│         ▲                            │                     │
│         │ (needs status)             │                     │
│         │                            │                     │
│  ┌──────┴──────────────────────────┐ │   ┌─────────────────┼─┐
│  │  Hooks Layer                    │ │   │                 │ │
│  │  ├─ useNetworkStatus()          │ │   │ OfflineIndicator│ │
│  │  ├─ useSyncProgress()           │ │   │ ├─ isOnline     │ │
│  │  ├─ useOfflineAPI()             │ │   │ ├─ pendingCount◄─┼─┘
│  │  ├─ usePendingSales()           │ │   │ └─ onClick()    │
│  │  └─ useOfflineInventory()       │ │   └────────┬────────┘
│  └──────┬──────────────────────────┘ │            │
│         │ (subscribe to)              │    setShowSyncModal
│         │                             │            │
│  ┌──────▼──────────────────────────┐ │   ┌────────▼────────┐
│  │  Offline Library               │ │   │ SyncStatusModal │
│  │                                │ │   │ ├─ Progress     │
│  │  ┌────────────────────────┐   │ │   │ ├─ Queue items  │
│  │  │ networkMonitor         │   │ │   │ ├─ Filters      │
│  │  │  listen(callback)    ◄─┼───┘     │ ├─ Retry btn    │
│  │  └────────────────────────┘   │     │ └─ Sync btn     │
│  │                                │     └──────┬──────────┘
│  │  ┌────────────────────────┐   │            │
│  │  │ syncEngine             │   │     Calls syncEngine.sync()
│  │  │  onProgress(callback) ◄─┼───┼─────────────┘
│  │  │  getProgress()         │   │
│  │  │  sync()                │   │
│  │  │  retryItem()           │   │
│  │  │  clearFailed()         │   │
│  │  └────────────────────────┘   │
│  │                                │
│  │  ┌────────────────────────┐   │
│  │  │ offlineDB              │   │
│  │  │ (IndexedDB wrapper)    │   │
│  │  │  init()                │   │
│  │  │  saveProduct()         │   │
│  │  │  savePendingSale()     │   │
│  │  │  addToQueue()          │   │
│  │  └────────────────────────┘   │
│  └────────────────────────────────┘
└──────────────────────────────────────────────────────────────┘
```

## Service Worker Activation

```
Page Load
    │
    ▼
main.tsx initializes
    │
    ▼
navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
    │
    ▼
Service Worker Installed
    │
    ├─ Intercepts all fetch() calls
    │
    ├─ install event
    │  └─ Cache static assets (HTML, CSS, JS)
    │
    ├─ activate event
    │  └─ Clean up old caches
    │
    └─ fetch event
       ├─ /api/* routes
       │  └─ Network First
       │     ├─ Try network
       │     ├─ Fallback to cache
       │     └─ Return offline error if neither
       │
       ├─ Static assets (CSS, JS, images)
       │  └─ Cache First
       │     ├─ Check cache
       │     ├─ If not found, fetch
       │     └─ Cache result
       │
       └─ HTML routes
          └─ Network First
             ├─ Try network
             └─ Fallback to cache or index.html
```

## Queue Processing Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                   Sync Queue Processing                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Collect Pending Items                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  offlineDB.getPendingQueueItems()                    │   │
│  │  Returns: ISyncQueueItem[]                           │   │
│  │  [{                                                  │   │
│  │    id: 'op1',                                        │   │
│  │    type: 'POST',                                     │   │
│  │    endpoint: '/api/sales',                           │   │
│  │    priority: 10,                                     │   │
│  │    status: 'pending',                                │   │
│  │    timestamp: 1234567890                             │   │
│  │  }, ...]                                             │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 2: Sort by Priority                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  items.sort((a, b) => {                              │   │
│  │    // Higher priority first                          │   │
│  │    if (b.priority !== a.priority)                    │   │
│  │      return b.priority - a.priority                  │   │
│  │    // Then by timestamp (older first)                │   │
│  │    return a.timestamp - b.timestamp                  │   │
│  │  })                                                  │   │
│  │                                                      │   │
│  │  Result: [payments, sales, inventory, products]     │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 3: Group by Endpoint                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  grouped = {                                         │   │
│  │    '/api/sales': [op1, op2, op3],                    │   │
│  │    '/api/inventory/adjust': [op4, op5],              │   │
│  │    '/api/products': [op6]                            │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 4: Send Batch Request                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /api/sync/batch {                              │   │
│  │    operations: [                                     │   │
│  │      {                                               │   │
│  │        id: 'op1',                                    │   │
│  │        type: 'POST',                                 │   │
│  │        endpoint: '/api/sales',                       │   │
│  │        data: {...}                                   │   │
│  │      },                                              │   │
│  │      ...                                             │   │
│  │    ]                                                 │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 5: Backend Processing                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  for each operation in batch {                       │   │
│  │    1. Validate input                                 │   │
│  │    2. Check idempotency (duplicate?)                 │   │
│  │    3. Execute operation                              │   │
│  │    4. Capture result/error                           │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 6: Return Results                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  {                                                   │   │
│  │    success: true,                                    │   │
│  │    results: [                                        │   │
│  │      {                                               │   │
│  │        id: 'op1',                                    │   │
│  │        success: true,                                │   │
│  │        serverId: 'sale_123',                         │   │
│  │        status: 200,                                  │   │
│  │        data: {...}                                   │   │
│  │      },                                              │   │
│  │      {                                               │   │
│  │        id: 'op2',                                    │   │
│  │        success: false,                               │   │
│  │        status: 400,                                  │   │
│  │        error: 'Validation failed'                    │   │
│  │      },                                              │   │
│  │      ...                                             │   │
│  │    ]                                                 │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 7: Update Local State                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  for each result {                                   │   │
│  │    if (success) {                                    │   │
│  │      - Update queue item status → 'success'          │   │
│  │      - Store server ID                               │   │
│  │      - Record in sync history                        │   │
│  │    } else {                                          │   │
│  │      - Update queue item status → 'failed'           │   │
│  │      - Store error message                           │   │
│  │      - Increment retry count                         │   │
│  │    }                                                 │   │
│  │  }                                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Step 8: Notify Listeners                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  syncEngine.onProgress({                             │   │
│  │    total: 6,                                         │   │
│  │    completed: 5,                                     │   │
│  │    failed: 1,                                        │   │
│  │    inProgress: 0                                     │   │
│  │  })                                                  │   │
│  │                                                      │   │
│  │  → Updates UI components                             │   │
│  │  → OfflineIndicator updates                          │   │
│  │  → SyncStatusModal refreshes                         │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  Sync Complete                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

This architecture ensures robust offline-first functionality with automatic syncing when connectivity is restored.
