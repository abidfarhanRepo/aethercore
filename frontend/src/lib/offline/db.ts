/**
 * IndexedDB wrapper for offline data storage
 * Handles products, inventory, users, and pending transactions
 */

interface DBSchema {
  products: IProduct
  categories: ICategory
  users: IUser
  inventory: IInventory
  pending_sales: IPendingSale
  pending_adjustments: IPendingAdjustment
  sync_queue: ISyncQueueItem
  sync_history: ISyncHistory
}

interface IProduct {
  id: string
  sku: string
  barcode?: string
  name: string
  description?: string
  category?: string
  subcategory?: string
  priceCents: number
  costCents?: number
  profitMarginCents?: number
  imageUrl?: string
  isActive: boolean
  version: number
  lastSyncedAt: number
}

interface ICategory {
  name: string
  description?: string
  parentCategory?: string
  version: number
  lastSyncedAt: number
}

interface IUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  department?: string
  role: string
  isActive: boolean
  version: number
  lastSyncedAt: number
}

interface IInventory {
  productId: string
  warehouseId?: string
  qty: number
  minThreshold?: number
  maxThreshold?: number
  reorderPoint?: number
  version: number
  lastSyncedAt: number
}

interface IPendingSale {
  id: string
  userId: string
  items: Array<{
    productId: string
    quantity: number
    priceCents: number
  }>
  subtotalCents: number
  discountCents?: number
  taxCents?: number
  totalCents: number
  paymentMethod: string
  paymentStatus: 'pending' | 'completed' | 'failed'
  notes?: string
  createdAt: number
  versions?: Record<string, number>
}

interface IPendingAdjustment {
  id: string
  productId: string
  type: 'in' | 'out' | 'return'
  quantity: number
  reason: string
  reference?: string
  createdAt: number
  version: number
}

interface ISyncQueueItem {
  id: string
  type: 'POST' | 'PUT' | 'DELETE'
  endpoint: string
  data: any
  timestamp: number
  status: 'pending' | 'syncing' | 'success' | 'failed'
  priority: number
  retries: number
  lastRetryAt?: number
  error?: string
  serverId?: string
}

interface ISyncHistory {
  queueId: string
  timestamp: number
  status: 'success' | 'failed'
  error?: string
  response?: any
  serverIds?: Record<string, string>
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private readonly dbName = 'aethercore-pos'
  private readonly version = 1
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return

    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('IndexedDB initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores with indexes
        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' })
          store.createIndex('sku', 'sku', { unique: true })
          store.createIndex('barcode', 'barcode', { unique: false })
          store.createIndex('category', 'category', { unique: false })
          store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('categories')) {
          const store = db.createObjectStore('categories', { keyPath: 'name' })
          store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' })
          store.createIndex('email', 'email', { unique: false })
          store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('inventory')) {
          const store = db.createObjectStore('inventory', {
            keyPath: ['productId', 'warehouseId'],
          })
          store.createIndex('productId', 'productId', { unique: false })
          store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('pending_sales')) {
          const store = db.createObjectStore('pending_sales', { keyPath: 'id' })
          store.createIndex('userId', 'userId', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('paymentStatus', 'paymentStatus', { unique: false })
        }

        if (!db.objectStoreNames.contains('pending_adjustments')) {
          const store = db.createObjectStore('pending_adjustments', {
            keyPath: 'id',
          })
          store.createIndex('productId', 'productId', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('priority', 'priority', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }

        if (!db.objectStoreNames.contains('sync_history')) {
          const store = db.createObjectStore('sync_history', { keyPath: 'queueId' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('status', 'status', { unique: false })
        }
      }
    })
  }

  private getStore(
    name: keyof DBSchema,
    mode: IDBTransactionMode = 'readonly'
  ): IDBObjectStore {
    if (!this.db) throw new Error('IndexedDB not initialized')
    const tx = this.db.transaction(name, mode)
    return tx.objectStore(name)
  }

  // Products
  async saveProduct(product: IProduct): Promise<void> {
    await this.init()
    const store = this.getStore('products', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(product)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getProduct(id: string): Promise<IProduct | undefined> {
    await this.init()
    const store = this.getStore('products')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAllProducts(): Promise<IProduct[]> {
    await this.init()
    const store = this.getStore('products')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async saveProducts(products: IProduct[]): Promise<void> {
    await this.init()
    const store = this.getStore('products', 'readwrite')
    return new Promise((resolve, reject) => {
      const tx = store.transaction as any
      let completed = 0

      products.forEach((product) => {
        const request = store.put(product)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          completed++
          if (completed === products.length) resolve()
        }
      })

      if (products.length === 0) resolve()
    })
  }

  // Inventory
  async saveInventoryLevel(inventory: IInventory): Promise<void> {
    await this.init()
    const store = this.getStore('inventory', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(inventory)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getInventoryLevel(productId: string): Promise<IInventory | undefined> {
    await this.init()
    const store = this.getStore('inventory')
    return new Promise((resolve, reject) => {
      const request = store.get([productId, undefined])
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAllInventory(): Promise<IInventory[]> {
    await this.init()
    const store = this.getStore('inventory')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  // Users
  async saveUser(user: IUser): Promise<void> {
    await this.init()
    const store = this.getStore('users', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(user)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getUser(id: string): Promise<IUser | undefined> {
    await this.init()
    const store = this.getStore('users')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAllUsers(): Promise<IUser[]> {
    await this.init()
    const store = this.getStore('users')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  // Pending Sales
  async savePendingSale(sale: IPendingSale): Promise<void> {
    await this.init()
    const store = this.getStore('pending_sales', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(sale)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getPendingSale(id: string): Promise<IPendingSale | undefined> {
    await this.init()
    const store = this.getStore('pending_sales')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAllPendingSales(): Promise<IPendingSale[]> {
    await this.init()
    const store = this.getStore('pending_sales')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async deletePendingSale(id: string): Promise<void> {
    await this.init()
    const store = this.getStore('pending_sales', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  // Pending Adjustments
  async savePendingAdjustment(adjustment: IPendingAdjustment): Promise<void> {
    await this.init()
    const store = this.getStore('pending_adjustments', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(adjustment)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getAllPendingAdjustments(): Promise<IPendingAdjustment[]> {
    await this.init()
    const store = this.getStore('pending_adjustments')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async deletePendingAdjustment(id: string): Promise<void> {
    await this.init()
    const store = this.getStore('pending_adjustments', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  // Sync Queue
  async addToQueue(item: ISyncQueueItem): Promise<void> {
    await this.init()
    const store = this.getStore('sync_queue', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.add(item)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getQueueItem(id: string): Promise<ISyncQueueItem | undefined> {
    await this.init()
    const store = this.getStore('sync_queue')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getPendingQueueItems(): Promise<ISyncQueueItem[]> {
    await this.init()
    const store = this.getStore('sync_queue')
    const index = store.index('status')
    return new Promise((resolve, reject) => {
      const request = index.getAll('pending')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getQueueItemsByStatus(
    status: 'pending' | 'syncing' | 'success' | 'failed'
  ): Promise<ISyncQueueItem[]> {
    await this.init()
    const store = this.getStore('sync_queue')
    const index = store.index('status')
    return new Promise((resolve, reject) => {
      const request = index.getAll(status)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getAllQueueItems(): Promise<ISyncQueueItem[]> {
    await this.init()
    const store = this.getStore('sync_queue')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async updateQueueItem(item: ISyncQueueItem): Promise<void> {
    await this.init()
    const store = this.getStore('sync_queue', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(item)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async deleteQueueItem(id: string): Promise<void> {
    await this.init()
    const store = this.getStore('sync_queue', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  // Sync History
  async addToHistory(item: ISyncHistory): Promise<void> {
    await this.init()
    const store = this.getStore('sync_history', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.add(item)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getSyncHistory(queueId: string): Promise<ISyncHistory | undefined> {
    await this.init()
    const store = this.getStore('sync_history')
    return new Promise((resolve, reject) => {
      const request = store.get(queueId)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async clearOldData(daysToKeep: number = 30): Promise<void> {
    await this.init()
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    // Clear old sales
    const salesStore = this.getStore('pending_sales', 'readwrite')
    const salesIndex = salesStore.index('createdAt')
    const salesRange = IDBKeyRange.upperBound(cutoffTime)
    await new Promise<void>((resolve, reject) => {
      const request = salesIndex.openCursor(salesRange)
      request.onerror = () => reject(request.error)
      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
    })

    // Clear old sync history
    const historyStore = this.getStore('sync_history', 'readwrite')
    const historyIndex = historyStore.index('timestamp')
    const historyRange = IDBKeyRange.upperBound(cutoffTime)
    await new Promise<void>((resolve, reject) => {
      const request = historyIndex.openCursor(historyRange)
      request.onerror = () => reject(request.error)
      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  }

  async getDBSize(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    let totalSize = 0
    const storeNames = Array.from(this.db.objectStoreNames)

    for (const storeName of storeNames) {
      const store = this.getStore(storeName as keyof DBSchema)
      const requests = await new Promise<number[]>((resolve, reject) => {
        const tx = store.transaction as any
        let count = 0
        const request = store.openCursor()
        const sizes: number[] = []

        request.onerror = () => reject(request.error)
        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result
          if (cursor) {
            sizes.push(JSON.stringify(cursor.value).length)
            cursor.continue()
          } else {
            resolve(sizes)
          }
        }
      })

      totalSize += requests.reduce((a, b) => a + b, 0)
    }

    return totalSize
  }
}

export const offlineDB = new OfflineDB()
export type { IProduct, ICategory, IUser, IInventory, IPendingSale, IPendingAdjustment, ISyncQueueItem, ISyncHistory }
