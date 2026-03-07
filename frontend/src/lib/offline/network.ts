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
  private readonly API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
  private readonly PING_ENDPOINTS = [
    `${this.API_BASE_URL}/health`,
    `${this.API_BASE_URL}/api/v1/health`,
    '/health',
    '/api/v1/health',
  ]
  private readonly CHECK_INTERVAL = 30000 // 30 seconds
  private readonly PING_TIMEOUT = 5000 // 5 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 2
  private pendingQueueSize: number = 0
  private consecutiveFailures: number = 0

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
    const isReachable = await this.pingAnyEndpoint()

    if (isReachable) {
      this.consecutiveFailures = 0
      this.setOnline(true)
      return
    }

    this.consecutiveFailures += 1

    // Avoid flapping to offline on transient failures.
    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.setOnline(false)
    }
  }

  private async pingAnyEndpoint(): Promise<boolean> {
    for (const endpoint of this.PING_ENDPOINTS) {
      try {
        const response = await this.pingEndpoint(endpoint)
        if (response.ok) {
          return true
        }
      } catch {
        // Try the next endpoint.
      }
    }

    return false
  }

  private async pingEndpoint(endpoint: string): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT)

    try {
      return await fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private setOnline(online: boolean): void {
    if (this.isOnline === online) return

    this.isOnline = online
    this.lastCheckedAt = Date.now()

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
