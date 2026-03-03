import React, { useState, useEffect } from 'react'
import { auditAPI } from '@/lib/api'
import { Download, Filter } from 'lucide-react'

interface ActivityLog {
  id: string
  action: string
  resource?: string
  resourceId?: string
  details?: string
  createdAt: string
}

interface ActivityLogProps {
  userId?: string
}

export default function ActivityLog({ userId }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [actionFilter, dateFrom, dateTo])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await auditAPI.list({
        action: actionFilter || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: 100,
      })
      setLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Action', 'Resource', 'Details']
    const rows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.action,
      log.resource || '-',
      log.details || '-',
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-log-${new Date().getTime()}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Activity Log</h2>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Action</label>
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Timestamp</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Action</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Resource</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{log.resource || '-'}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{log.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No activity logs found.
          </div>
        )}
      </div>
    </div>
  )
}
