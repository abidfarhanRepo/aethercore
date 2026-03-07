import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { networkMonitor, type ConnectionStatus } from '../lib/offline/network'
import { syncEngine, type SyncProgress } from '../lib/offline/sync'

interface OfflineIndicatorProps {
  showSyncModal?: (show: boolean) => void
  mode?: 'floating' | 'compact'
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ showSyncModal, mode = 'floating' }) => {
  const [status, setStatus] = useState<ConnectionStatus>(networkMonitor.getStatus())
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [deadLetterOpenCount, setDeadLetterOpenCount] = useState(0)

  const applyProgress = (nextProgress: SyncProgress | null) => {
    setProgress(nextProgress)
    if (nextProgress) {
      const pending = Math.max(0, nextProgress.total - nextProgress.completed)
      networkMonitor.setPendingQueueSize(pending)
    }
  }

  useEffect(() => {
    const unsubscribeNetwork = networkMonitor.listen(setStatus)
    const unsubscribeSync = syncEngine.onProgress(applyProgress)

    // Initialize progress
    syncEngine.getProgress().then(applyProgress)

    void api
      .get('/api/v1/sync/status')
      .then((res) => {
        const count = Number(res.data?.deadLetter?.open)
        setDeadLetterOpenCount(Number.isFinite(count) ? count : 0)
      })
      .catch(() => {
        setDeadLetterOpenCount(0)
      })

    return () => {
      unsubscribeNetwork()
      unsubscribeSync()
    }
  }, [])

  const isOnline = status.isOnline
  const pendingCount = Math.max(0, (progress?.total ?? 0) - (progress?.completed ?? 0))
  const isSyncing = progress && progress.inProgress > 0

  if (mode === 'floating' && isOnline && pendingCount === 0) {
    return null // Don't show indicator if online and nothing to sync
  }

  if (mode === 'compact') {
    return (
      <button
        type="button"
        className="w-full text-left rounded-md border border-border/80 bg-muted/40 px-2.5 py-2 text-xs hover:bg-muted transition-colors"
        onClick={() => showSyncModal?.(true)}
        title={`Sync status: ${isOnline ? 'Online' : 'Offline'} | Pending: ${pendingCount}${deadLetterOpenCount > 0 ? ` | Dead letter: ${deadLetterOpenCount}` : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} ${isSyncing ? 'animate-pulse' : ''}`}
            />
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <span className="text-muted-foreground">Pending: {pendingCount}</span>
        </div>
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm cursor-pointer transition-all ${
        isOnline
          ? 'bg-blue-100 text-blue-800 border border-blue-300'
          : 'bg-red-100 text-red-800 border border-red-300'
      }`}
      onClick={() => {
        if (pendingCount > 0) {
          setShowDetails(!showDetails)
          showSyncModal?.(true)
        }
      }}
      title={
        isOnline
          ? `${pendingCount} items pending sync`
          : 'Connection lost - changes will sync when online'
      }
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-600' : 'bg-red-600'
          } ${isSyncing ? 'animate-pulse' : ''}`}
        />
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      {/* Pending count */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-current opacity-70">
          {isSyncing ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{pendingCount}</span>
              <span>pending</span>
            </>
          )}
        </div>
      )}

      {/* Expand icon */}
      {pendingCount > 0 && (
        <div
          className={`ml-auto transition-transform ${
            showDetails ? 'rotate-180' : ''
          }`}
        >
          ▼
        </div>
      )}
    </div>
  )
}

export default OfflineIndicator
