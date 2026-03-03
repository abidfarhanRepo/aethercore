/**
 * React hooks for offline functionality
 */

import { useEffect, useState } from 'react'
import { networkMonitor, type ConnectionStatus } from '../offline/network'
import { syncEngine, type SyncProgress } from '../offline/sync'
import { offlineDB } from '../offline/db'

/**
 * Hook to monitor network status
 */
export function useNetworkStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(networkMonitor.getStatus())

  useEffect(() => {
    const unsubscribe = networkMonitor.listen(setStatus)
    return unsubscribe
  }, [])

  return status
}

/**
 * Hook to monitor sync progress
 */
export function useSyncProgress(): SyncProgress | null {
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  useEffect(() => {
    syncEngine.getProgress().then(setProgress)
    const unsubscribe = syncEngine.onProgress(setProgress)
    return unsubscribe
  }, [])

  return progress
}

/**
 * Hook for offline-aware API calls
 */
export function useOfflineAPI() {
  const networkStatus = useNetworkStatus()

  const post = async (endpoint: string, data: any, priority: number = 0) => {
    if (!networkStatus.isOnline) {
      const queueId = await syncEngine.queueOperation('POST', endpoint, data, priority)
      return {
        offline: true,
        queued: true,
        queueId,
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return {
        offline: false,
        queued: false,
        data: await response.json(),
      }
    } catch (error) {
      const queueId = await syncEngine.queueOperation('POST', endpoint, data, priority)
      return {
        offline: true,
        queued: true,
        queueId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  const put = async (endpoint: string, data: any, priority: number = 0) => {
    if (!networkStatus.isOnline) {
      const queueId = await syncEngine.queueOperation('PUT', endpoint, data, priority)
      return {
        offline: true,
        queued: true,
        queueId,
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return {
        offline: false,
        queued: false,
        data: await response.json(),
      }
    } catch (error) {
      const queueId = await syncEngine.queueOperation('PUT', endpoint, data, priority)
      return {
        offline: true,
        queued: true,
        queueId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    isOnline: networkStatus.isOnline,
    post,
    put,
  }
}

/**
 * Hook for managing pending sales
 */
export function usePendingSales() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadSales = async () => {
    setLoading(true)
    try {
      const pendingSales = await offlineDB.getAllPendingSales()
      setSales(pendingSales)
    } finally {
      setLoading(false)
    }
  }

  const saveSale = async (sale: any) => {
    const pendingSale = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...sale,
      createdAt: Date.now(),
    }
    await offlineDB.savePendingSale(pendingSale)
    await loadSales()
    return pendingSale
  }

  const deleteSale = async (saleId: string) => {
    await offlineDB.deletePendingSale(saleId)
    await loadSales()
  }

  useEffect(() => {
    loadSales()
  }, [])

  return {
    sales,
    loading,
    saveSale,
    deleteSale,
    reload: loadSales,
  }
}

/**
 * Hook for inventory adjustments while offline
 */
export function useOfflineInventory() {
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadAdjustments = async () => {
    setLoading(true)
    try {
      const pendingAdjustments = await offlineDB.getAllPendingAdjustments()
      setAdjustments(pendingAdjustments)
    } finally {
      setLoading(false)
    }
  }

  const addAdjustment = async (adjustment: any) => {
    const pendingAdjustment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...adjustment,
      createdAt: Date.now(),
      version: 1,
    }
    await offlineDB.savePendingAdjustment(pendingAdjustment)
    await loadAdjustments()
    return pendingAdjustment
  }

  const deleteAdjustment = async (adjustmentId: string) => {
    await offlineDB.deletePendingAdjustment(adjustmentId)
    await loadAdjustments()
  }

  useEffect(() => {
    loadAdjustments()
  }, [])

  return {
    adjustments,
    loading,
    addAdjustment,
    deleteAdjustment,
    reload: loadAdjustments,
  }
}

export default {
  useNetworkStatus,
  useSyncProgress,
  useOfflineAPI,
  usePendingSales,
  useOfflineInventory,
}
