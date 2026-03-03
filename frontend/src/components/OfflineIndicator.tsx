import React, { useEffect, useState } from 'react'
import { networkMonitor, type ConnectionStatus } from '../lib/offline/network'
import { syncEngine, type SyncProgress } from '../lib/offline/sync'

interface OfflineIndicatorProps {
  showSyncModal?: (show: boolean) => void
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ showSyncModal }) => {
  const [status, setStatus] = useState<ConnectionStatus>(networkMonitor.getStatus())
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const unsubscribeNetwork = networkMonitor.listen(setStatus)
    const unsubscribeSync = syncEngine.onProgress(setProgress)

    // Initialize progress
    syncEngine.getProgress().then(setProgress)

    return () => {
      unsubscribeNetwork()
      unsubscribeSync()
    }
  }, [])

  const isOnline = status.isOnline
  const pendingCount = progress?.total ?? 0
  const isSyncing = progress && progress.inProgress > 0

  if (isOnline && pendingCount === 0) {
    return null // Don't show indicator if online and nothing to sync
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
