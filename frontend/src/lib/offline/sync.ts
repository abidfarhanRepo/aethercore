/**
 * Sync engine for offline queue management and synchronization
 */

import { api } from '../api'
import { offlineDB, ISyncQueueItem } from './db'
import { networkMonitor } from './network'

interface SyncOptions {
  maxRetries?: number
  backoffMultiplier?: number
  maxBackoffDelay?: number
}

interface SyncResult {
  success: boolean
  itemId: string
  serverId?: string
  error?: string
}

interface SyncProgress {
  total: number
  completed: number
  failed: number
  inProgress: number
}

type SyncListener = (progress: SyncProgress) => void

class SyncEngine {
  private syncingIds: Set<string> = new Set()
  private listeners: Set<SyncListener> = new Set()
  private syncPromise: Promise<void> | null = null
  private readonly options: Required<SyncOptions> = {
    maxRetries: 3,
    backoffMultiplier: 2,
    maxBackoffDelay: 30000,
  }
  private networkUnsubscribe: (() => void) | null = null

  constructor(options?: SyncOptions) {
    this.options = { ...this.options, ...options }
    this.setupNetworkListener()
  }

  private setupNetworkListener(): void {
    this.networkUnsubscribe = networkMonitor.listen((status) => {
      if (status.isOnline) {
        // Auto-sync when connection is restored
        this.sync().catch((error) => {
          console.error('Auto-sync failed:', error)
        })
      }
    })
  }

  /**
   * Add an operation to the sync queue
   */
  async queueOperation(
    type: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data: any,
    priority: number = 0
  ): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const queueItem: ISyncQueueItem = {
      id,
      type,
      endpoint,
      data,
      timestamp: Date.now(),
      status: 'pending',
      priority,
      retries: 0,
    }

    await offlineDB.addToQueue(queueItem)
    console.log(`[SyncEngine] Queued operation: ${type} ${endpoint}`)

    return id
  }

  /**
   * Start synchronization process
   */
  async sync(): Promise<SyncResult[]> {
    if (this.syncPromise) {
      return this.syncPromise as any
    }

    this.syncPromise = this.performSync()

    try {
      await this.syncPromise
    } finally {
      this.syncPromise = null
    }

    return []
  }

  private async performSync(): Promise<void> {
    if (!networkMonitor.isConnected()) {
      console.log('[SyncEngine] Network offline, skipping sync')
      return
    }

    console.log('[SyncEngine] Starting synchronization...')

    try {
      const pendingItems = await offlineDB.getPendingQueueItems()

      if (pendingItems.length === 0) {
        console.log('[SyncEngine] No items to sync')
        return
      }

      // Sort by priority (higher first) and timestamp
      const sortedItems = pendingItems.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority
        }
        return a.timestamp - b.timestamp
      })

      // Group by endpoint for batching
      const grouped = this.groupByEndpoint(sortedItems)

      const results: SyncResult[] = []

      for (const [endpoint, items] of Object.entries(grouped)) {
        const endpointResults = await this.syncEndpoint(endpoint, items)
        results.push(...endpointResults)
      }

      console.log(`[SyncEngine] Sync completed: ${results.length} items`)
      this.notifyProgress()
    } catch (error) {
      console.error('[SyncEngine] Sync failed:', error)
    }
  }

  private groupByEndpoint(items: ISyncQueueItem[]): Record<string, ISyncQueueItem[]> {
    const grouped: Record<string, ISyncQueueItem[]> = {}

    items.forEach((item) => {
      if (!grouped[item.endpoint]) {
        grouped[item.endpoint] = []
      }
      grouped[item.endpoint].push(item)
    })

    return grouped
  }

  private async syncEndpoint(endpoint: string, items: ISyncQueueItem[]): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    // Try batch sync first (if supported)
    if (endpoint === '/api/sync/batch' || endpoint === '/api/sales') {
      const batchResult = await this.syncBatch(items)
      return batchResult
    }

    // Fall back to individual syncs
    for (const item of items) {
      try {
        const result = await this.syncItem(item)
        results.push(result)
      } catch (error) {
        console.error(`[SyncEngine] Failed to sync item ${item.id}:`, error)
        results.push({
          success: false,
          itemId: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  private async syncBatch(items: ISyncQueueItem[]): Promise<SyncResult[]> {
    const results: SyncResult[] = []

    try {
      // Prepare batch payload
      const operations = items.map((item) => ({
        id: item.id,
        type: item.type,
        operationType: item.type,
        endpoint: item.endpoint,
        offlineOpId: item.data?.offlineOpId,
        terminalId: item.data?.terminalId,
        clientCreatedAt: item.data?.clientCreatedAt,
        data: item.data,
      }))

      // Send batch request
      const response = await api.post('/api/sync/batch', {
        operations,
      })

      const { results: batchResults } = response.data

      // Process results
      for (const item of items) {
        const batchResult = batchResults.find((r: any) => r.id === item.id)

        const status = batchResult?.status as string | undefined
        const successStatus = status === 'created' || status === 'duplicate'

        if (successStatus) {
          // Update queue item status
          item.status = 'success'
          item.serverId = batchResult.saleId || batchResult.serverId
          await offlineDB.updateQueueItem(item)

          // Record in history
          await offlineDB.addToHistory({
            queueId: item.id,
            timestamp: Date.now(),
            status: 'success',
            response: batchResult,
            serverIds: { [item.id]: batchResult.saleId || batchResult.serverId },
          })

          results.push({
            success: true,
            itemId: item.id,
            serverId: batchResult.saleId || batchResult.serverId,
          })
        } else {
          // Handle failure
          await this.handleSyncFailure(item, batchResult?.message || batchResult?.error || 'Batch sync failed')
          results.push({
            success: false,
            itemId: item.id,
            error: batchResult?.message || batchResult?.error,
          })
        }
      }
    } catch (error) {
      // Batch sync failed, retry individually
      console.warn('[SyncEngine] Batch sync failed, retrying individually:', error)
      for (const item of items) {
        const result = await this.syncItem(item)
        results.push(result)
      }
    }

    return results
  }

  private async syncItem(item: ISyncQueueItem): Promise<SyncResult> {
    try {
      this.syncingIds.add(item.id)
      this.notifyProgress()

      // Update status to syncing
      item.status = 'syncing'
      await offlineDB.updateQueueItem(item)

      let response

      try {
        if (item.type === 'POST') {
          response = await api.post(item.endpoint, item.data)
        } else if (item.type === 'PUT') {
          response = await api.put(item.endpoint, item.data)
        } else if (item.type === 'DELETE') {
          response = await api.delete(item.endpoint)
        }
      } catch (error: any) {
        // Check if it's a retryable error
        const statusCode = error.response?.status
        const isRetryable = !statusCode || statusCode >= 500 || statusCode === 408 || statusCode === 429

        if (isRetryable && item.retries < this.options.maxRetries) {
          // Calculate backoff delay
          const delay = Math.min(
            1000 * Math.pow(this.options.backoffMultiplier, item.retries),
            this.options.maxBackoffDelay
          )

          item.retries++
          item.lastRetryAt = Date.now()
          item.status = 'pending'
          await offlineDB.updateQueueItem(item)

          console.log(
            `[SyncEngine] Retrying item ${item.id} in ${delay}ms (attempt ${item.retries}/${this.options.maxRetries})`
          )

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay))

          // Retry
          this.syncingIds.delete(item.id)
          return this.syncItem(item)
        } else {
          // Permanent failure
          throw error
        }
      }

      // Success
      item.status = 'success'
      item.serverId = response?.data?.id || response?.data?.serverId
      await offlineDB.updateQueueItem(item)

      // Record in history
      await offlineDB.addToHistory({
        queueId: item.id,
        timestamp: Date.now(),
        status: 'success',
        response: response?.data,
      })

      console.log(`[SyncEngine] Successfully synced item ${item.id}`)

      return {
        success: true,
        itemId: item.id,
        serverId: item.serverId,
      }
    } catch (error) {
      console.error(`[SyncEngine] Sync failed for item ${item.id}:`, error)
      await this.handleSyncFailure(item, error instanceof Error ? error.message : 'Unknown error')

      return {
        success: false,
        itemId: item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      this.syncingIds.delete(item.id)
      this.notifyProgress()
    }
  }

  private async handleSyncFailure(item: ISyncQueueItem, error: string): Promise<void> {
    item.status = 'failed'
    item.error = error
    item.retries++
    item.lastRetryAt = Date.now()

    await offlineDB.updateQueueItem(item)

    // Record in history
    await offlineDB.addToHistory({
      queueId: item.id,
      timestamp: Date.now(),
      status: 'failed',
      error,
    })
  }

  /**
   * Get current sync queue
   */
  async getQueue(): Promise<ISyncQueueItem[]> {
    return offlineDB.getAllQueueItems()
  }

  /**
   * Get items with given status
   */
  async getQueueByStatus(status: 'pending' | 'syncing' | 'success' | 'failed'): Promise<ISyncQueueItem[]> {
    return offlineDB.getQueueItemsByStatus(status)
  }

  /**
   * Retry a failed item
   */
  async retryItem(itemId: string): Promise<SyncResult> {
    const item = await offlineDB.getQueueItem(itemId)

    if (!item) {
      throw new Error(`Queue item not found: ${itemId}`)
    }

    item.status = 'pending'
    item.retries = 0
    await offlineDB.updateQueueItem(item)

    return this.syncItem(item)
  }

  /**
   * Clear failed items
   */
  async clearFailed(): Promise<number> {
    const failed = await offlineDB.getQueueByStatus('failed')

    for (const item of failed) {
      await offlineDB.deleteQueueItem(item.id)
    }

    this.notifyProgress()
    return failed.length
  }

  /**
   * Clear all queue items
   */
  async clearQueue(): Promise<void> {
    const items = await offlineDB.getAllQueueItems()

    for (const item of items) {
      await offlineDB.deleteQueueItem(item.id)
    }

    this.notifyProgress()
  }

  /**
   * Get sync progress
   */
  async getProgress(): Promise<SyncProgress> {
    const items = await offlineDB.getAllQueueItems()

    const failed = items.filter((i) => i.status === 'failed').length
    const completed = items.filter((i) => i.status === 'success').length

    return {
      total: items.length,
      completed,
      failed,
      inProgress: this.syncingIds.size,
    }
  }

  /**
   * Subscribe to sync progress updates
   */
  onProgress(listener: SyncListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyProgress(): void {
    this.getProgress().then((progress) => {
      this.listeners.forEach((listener) => {
        try {
          listener(progress)
        } catch (error) {
          console.error('Error in sync progress listener:', error)
        }
      })
    })
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe()
    }
    this.listeners.clear()
    this.syncingIds.clear()
  }
}

export const syncEngine = new SyncEngine()
export type { SyncResult, SyncProgress, SyncListener, SyncOptions }
