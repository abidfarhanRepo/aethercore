import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { syncEngine, type SyncProgress } from '../lib/offline/sync'
import { type ISyncQueueItem } from '../lib/offline/db'

interface SyncStatusModalProps {
  isOpen: boolean
  onClose: () => void
}

interface DeadLetterItem {
  id: string
  terminalId: string | null
  offlineOpId: string | null
  endpoint: string
  operationType: string
  errorCode: string | null
  errorDetail: string | null
  attemptCount: number
  lastFailedAt: string
  createdAt: string
}

const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose }) => {
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [queueItems, setQueueItems] = useState<ISyncQueueItem[]>([])
  const [deadLetterItems, setDeadLetterItems] = useState<DeadLetterItem[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed'>('all')
  const [syncing, setSyncing] = useState(false)
  const [replayingId, setReplayingId] = useState<string | null>(null)

  const loadDeadLetterItems = async () => {
    try {
      const response = await api.get('/api/sync/dead-letter')
      const items = Array.isArray(response.data?.items) ? response.data.items : []
      setDeadLetterItems(items)
    } catch (error) {
      console.error('Failed to load dead-letter items:', error)
      setDeadLetterItems([])
    }
  }

  const loadData = async () => {
    const [items, prog] = await Promise.all([syncEngine.getQueue(), syncEngine.getProgress()])
    setQueueItems(items)
    setProgress(prog)
    await loadDeadLetterItems()
  }

  useEffect(() => {
    if (!isOpen) return

    void loadData()
    const unsubscribe = syncEngine.onProgress(setProgress)

    return unsubscribe
  }, [isOpen])

  const filteredItems = queueItems.filter((item) => {
    if (filter === 'pending') return item.status === 'pending'
    if (filter === 'failed') return item.status === 'failed'
    return true
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncEngine.sync()
      await loadData()
    } finally {
      setSyncing(false)
    }
  }

  const handleRetry = async (itemId: string) => {
    try {
      await syncEngine.retryItem(itemId)
      await loadData()
    } catch (error) {
      console.error('Retry failed:', error)
    }
  }

  const handleClearFailed = async () => {
    if (window.confirm('Clear all failed items? They will not be synced.')) {
      await syncEngine.clearFailed()
      await loadData()
    }
  }

  const handleClearAll = async () => {
    if (window.confirm('Clear all pending items? This cannot be undone.')) {
      await syncEngine.clearQueue()
      await loadData()
    }
  }

  const handleReplayDeadLetter = async (id: string) => {
    setReplayingId(id)
    try {
      await api.post(`/api/sync/dead-letter/${id}/replay`)
      await loadData()
    } catch (error) {
      console.error('Dead-letter replay failed:', error)
      await loadDeadLetterItems()
    } finally {
      setReplayingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Sync Status</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
                <div className="text-xs text-gray-600">Synced</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{progress.inProgress}</div>
                <div className="text-xs text-gray-600">In Progress</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Failed
          </button>
        </div>

        {/* Queue and dead-letter items */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Queue</h3>
              <span className="text-xs text-gray-500">{filteredItems.length} item(s)</span>
            </div>
            {filteredItems.length === 0 ? (
              <div className="text-center py-6 text-gray-500 rounded border border-gray-200 bg-gray-50">
                {filter === 'all' ? 'No pending operations' : `No ${filter} operations`}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded border border-gray-200 bg-gray-50"
                  >
                    <div className="mt-1">
                      {item.status === 'syncing' && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                      )}
                      {item.status === 'pending' && (
                        <div className="w-2 h-2 bg-yellow-600 rounded-full" />
                      )}
                      {item.status === 'success' && (
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                      )}
                      {item.status === 'failed' && (
                        <div className="w-2 h-2 bg-red-600 rounded-full" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {item.type} {item.endpoint}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString()}
                        {item.retries > 0 && ` • Retries: ${item.retries}`}
                      </div>
                      {item.error && (
                        <div className="text-xs text-red-600 mt-1">{item.error}</div>
                      )}
                    </div>

                    {item.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(item.id)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Dead Letter</h3>
              <span className="text-xs text-gray-500">{deadLetterItems.length} open</span>
            </div>

            {deadLetterItems.length === 0 ? (
              <div className="text-center py-6 text-gray-500 rounded border border-gray-200 bg-gray-50">
                No unresolved dead-letter items
              </div>
            ) : (
              <div className="rounded border border-gray-200 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold">Operation</th>
                      <th className="text-left px-2 py-2 font-semibold">Terminal</th>
                      <th className="text-left px-2 py-2 font-semibold">Attempts</th>
                      <th className="text-left px-2 py-2 font-semibold">Last Failed</th>
                      <th className="text-left px-2 py-2 font-semibold">Error</th>
                      <th className="text-right px-2 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadLetterItems.map((item) => (
                      <tr key={item.id} className="border-t border-gray-200 align-top">
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-900">{item.operationType} {item.endpoint}</div>
                          <div className="text-gray-500">{item.offlineOpId || item.id}</div>
                        </td>
                        <td className="px-2 py-2 text-gray-700">{item.terminalId || '-'}</td>
                        <td className="px-2 py-2 text-gray-700">{item.attemptCount}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                          {new Date(item.lastFailedAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-red-700 max-w-xs">
                          <div className="truncate" title={item.errorDetail || item.errorCode || ''}>
                            {item.errorCode || 'ERROR'}: {item.errorDetail || 'Unknown error'}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => handleReplayDeadLetter(item.id)}
                            disabled={replayingId === item.id}
                            className={`px-2 py-1 rounded text-white ${
                              replayingId === item.id
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {replayingId === item.id ? 'Replaying...' : 'Replay'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-2 justify-between">
          <div className="flex gap-2">
            {progress && progress.failed > 0 && (
              <button
                onClick={handleClearFailed}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Clear Failed
              </button>
            )}
            {progress && progress.total > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100 font-medium"
            >
              Close
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !progress || progress.total === 0}
              className={`px-4 py-2 text-sm rounded font-medium text-white ${
                syncing || !progress || progress.total === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SyncStatusModal
