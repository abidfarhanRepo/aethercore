import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import DateRangeSelector from '@/components/DateRangeSelector'
import { reportsAPI } from '@/lib/api'

interface DateRange {
  from: Date
  to: Date
}

interface PurchaseSupplier {
  name?: string | null
}

interface PurchaseUser {
  firstName?: string | null
  lastName?: string | null
}

interface PurchaseItem {
  id: string
  qty: number
}

interface PurchaseRecord {
  id: string
  poNumber?: string | null
  createdAt: string
  expectedDelivery?: string | null
  totalCents: number
  status: string
  supplier?: PurchaseSupplier | null
  user?: PurchaseUser | null
  items?: PurchaseItem[]
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((cents || 0) / 100)
}

export default function PurchasesTransactions() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    const loadPurchases = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await reportsAPI.visiblePurchases({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        })
        const nextPurchases = (response.data?.items || []) as PurchaseRecord[]
        setPurchases(nextPurchases)
        setSelectedIds([])
      } catch (e) {
        console.error('Failed to load visible purchases', e)
        setError('Failed to load purchases. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    void loadPurchases()
  }, [dateRange])

  const selectedCount = selectedIds.length
  const isAllSelected = purchases.length > 0 && selectedIds.length === purchases.length

  const selectedPurchases = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return purchases.filter((purchase) => selectedSet.has(purchase.id))
  }, [purchases, selectedIds])

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(purchases.map((purchase) => purchase.id))
  }

  const toggleRowSelection = (purchaseId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(purchaseId)) {
        return prev.filter((id) => id !== purchaseId)
      }
      return [...prev, purchaseId]
    })
  }

  const exportSelectedAsCsv = () => {
    if (selectedPurchases.length === 0) {
      return
    }

    const header = [
      'purchaseOrderId',
      'poNumber',
      'createdAt',
      'expectedDelivery',
      'supplier',
      'createdBy',
      'status',
      'itemCount',
      'totalCents',
    ]

    const rows = selectedPurchases.map((purchase) => {
      const createdBy = `${purchase.user?.firstName || ''} ${purchase.user?.lastName || ''}`.trim() || 'N/A'
      return [
        purchase.id,
        purchase.poNumber || '',
        purchase.createdAt,
        purchase.expectedDelivery || '',
        purchase.supplier?.name || 'N/A',
        createdBy,
        purchase.status,
        String(purchase.items?.length || 0),
        String(purchase.totalCents || 0),
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `purchase-transactions-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Transactions</h1>
        <p className="text-sm text-slate-600">Full purchase order visibility for selected dates with row-level selection.</p>
      </div>

      <DateRangeSelector onSelect={setDateRange} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button
            type="button"
            onClick={exportSelectedAsCsv}
            disabled={selectedCount === 0}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Export Selected ({selectedCount})
          </button>
          <div className="text-sm text-slate-600">
            Showing {purchases.length} purchase order(s) from {format(dateRange.from, 'MMM dd, yyyy')} to {format(dateRange.to, 'MMM dd, yyyy')}
          </div>
        </div>

        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading purchase transactions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      aria-label="Select all purchases"
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">PO ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">PO Number</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Date</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Supplier</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Created By</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Expected Delivery</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Items</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Total</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const createdBy = `${purchase.user?.firstName || ''} ${purchase.user?.lastName || ''}`.trim() || 'N/A'
                  const isSelected = selectedIds.includes(purchase.id)
                  return (
                    <tr key={purchase.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Select purchase ${purchase.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(purchase.id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-800">{purchase.id}</td>
                      <td className="px-3 py-3 text-slate-700">{purchase.poNumber || 'N/A'}</td>
                      <td className="px-3 py-3 text-slate-700">{format(new Date(purchase.createdAt), 'MMM dd, yyyy HH:mm')}</td>
                      <td className="px-3 py-3 text-slate-700">{purchase.supplier?.name || 'N/A'}</td>
                      <td className="px-3 py-3 text-slate-700">{createdBy}</td>
                      <td className="px-3 py-3 text-slate-700">{purchase.expectedDelivery ? format(new Date(purchase.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}</td>
                      <td className="px-3 py-3 text-right text-slate-800">{purchase.items?.length || 0}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(purchase.totalCents || 0)}</td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                          {purchase.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {!purchases.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                      No purchase orders found for the selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
