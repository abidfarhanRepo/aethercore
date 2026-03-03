/**
 * Network connectivity detection and monitoring
 */

interface ConnectionStatus {
  isOnline: boolean
  lastCheckedAt: number
  estimatedSyncTime: number
}

interface NetworkListener {
  (status: ConnectionStatus): void
}

class NetworkMonitor {
  private isOnline: boolean = navigator.onLine
  private listeners: Set<NetworkListener> = new Set()
  private lastCheckedAt: number = Date.now()
  private checkInterval: NodeJS.Timeout | null = null
  private readonly PING_ENDPOINT = '/api/health'
  private readonly CHECK_INTERVAL = 30000 // 30 seconds
  private readonly PING_TIMEOUT = 5000 // 5 seconds
  private pendingQueueSize: number = 0

  constructor() {
    this.setupListeners()
  }

  private setupListeners(): void {
    window.addEventListener('online', () => {
      this.setOnline(true)
    })

    window.addEventListener('offline', () => {
      this.setOnline(false)
    })

    // Periodic connectivity check
    this.startPeriodicCheck()
  }

  private startPeriodicCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkConnectivity()
    }, this.CHECK_INTERVAL)
  }

  private async checkConnectivity(): Promise<void> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT)

      const response = await fetch(this.PING_ENDPOINT, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        this.setOnline(true)
      } else {
        this.setOnline(false)
      }
    } catch (error) {
      this.setOnline(false)
    }
  }

  private setOnline(online: boolean): void {
    if (this.isOnline === online) return

    this.isOnline = online
    this.lastCheckedAt = Date.now()

    if (online) {
      console.log('[Network] Connection restored')
    } else {
      console.log('[Network] Connection lost')
    }

    this.notifyListeners()
  }

  private notifyListeners(): void {
    const status: ConnectionStatus = {
      isOnline: this.isOnline,
      lastCheckedAt: this.lastCheckedAt,
      estimatedSyncTime: this.estimateSyncTime(),
    }

    this.listeners.forEach((listener) => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error in network listener:', error)
      }
    })
  }

  private estimateSyncTime(): number {
    // Estimate sync time based on queue size
    // Assume ~100ms per item (API call overhead)
    return Math.max(500, this.pendingQueueSize * 100)
  }

  public listen(callback: NetworkListener): () => void {
    this.listeners.add(callback)

    return () => {
      this.listeners.delete(callback)
    }
  }

  public getStatus(): ConnectionStatus {
    return {
      isOnline: this.isOnline,
      lastCheckedAt: this.lastCheckedAt,
      estimatedSyncTime: this.estimateSyncTime(),
    }
  }

  public isConnected(): boolean {
    return this.isOnline
  }

  public setPendingQueueSize(size: number): void {
    this.pendingQueueSize = size
  }

  public async waitForConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isOnline) return true

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        unsubscribe()
        resolve(false)
      }, timeout)

      const unsubscribe = this.listen((status) => {
        if (status.isOnline) {
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(true)
        }
      })
    })
  }

  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    this.listeners.clear()
  }
}

export const networkMonitor = new NetworkMonitor()
export type { ConnectionStatus, NetworkListener }
