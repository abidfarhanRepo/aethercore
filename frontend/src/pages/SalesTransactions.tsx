import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import DateRangeSelector from '@/components/DateRangeSelector'
import { reportsAPI } from '@/lib/api'

interface DateRange {
  from: Date
  to: Date
}

interface SaleUser {
  firstName?: string | null
  lastName?: string | null
}

interface SaleItem {
  id: string
  qty: number
}

interface SaleRecord {
  id: string
  receiptPublicId?: string | null
  createdAt: string
  totalCents: number
  taxCents: number
  discountCents: number
  status: string
  user?: SaleUser | null
  items?: SaleItem[]
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((cents || 0) / 100)
}

export default function SalesTransactions() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await reportsAPI.visibleSales({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        })
        const nextSales = (response.data?.items || []) as SaleRecord[]
        setSales(nextSales)
        setSelectedIds([])
      } catch (e) {
        console.error('Failed to load visible sales', e)
        setError('Failed to load sales. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    void loadSales()
  }, [dateRange])

  const selectedCount = selectedIds.length
  const isAllSelected = sales.length > 0 && selectedIds.length === sales.length

  const selectedSales = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return sales.filter((sale) => selectedSet.has(sale.id))
  }, [sales, selectedIds])

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(sales.map((sale) => sale.id))
  }

  const toggleRowSelection = (saleId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(saleId)) {
        return prev.filter((id) => id !== saleId)
      }
      return [...prev, saleId]
    })
  }

  const exportSelectedAsCsv = () => {
    if (selectedSales.length === 0) {
      return
    }

    const header = [
      'saleId',
      'receiptPublicId',
      'createdAt',
      'operator',
      'status',
      'itemCount',
      'discountCents',
      'taxCents',
      'totalCents',
    ]

    const rows = selectedSales.map((sale) => {
      const operatorName = `${sale.user?.firstName || ''} ${sale.user?.lastName || ''}`.trim() || 'N/A'
      return [
        sale.id,
        sale.receiptPublicId || '',
        sale.createdAt,
        operatorName,
        sale.status,
        String(sale.items?.length || 0),
        String(sale.discountCents || 0),
        String(sale.taxCents || 0),
        String(sale.totalCents || 0),
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `sales-transactions-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Transactions</h1>
        <p className="text-sm text-slate-600">Complete sales list for selected dates with row-level selection.</p>
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
            Showing {sales.length} complete sale(s) from {format(dateRange.from, 'MMM dd, yyyy')} to {format(dateRange.to, 'MMM dd, yyyy')}
          </div>
        </div>

        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading sales transactions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      aria-label="Select all sales"
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Sale ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Receipt</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Date</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Operator</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-900">Status</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Items</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Discount</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Tax</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const operatorName = `${sale.user?.firstName || ''} ${sale.user?.lastName || ''}`.trim() || 'N/A'
                  const isSelected = selectedIds.includes(sale.id)
                  return (
                    <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Select sale ${sale.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(sale.id)}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-800">{sale.id}</td>
                      <td className="px-3 py-3 text-slate-700">{sale.receiptPublicId || 'N/A'}</td>
                      <td className="px-3 py-3 text-slate-700">{format(new Date(sale.createdAt), 'MMM dd, yyyy HH:mm')}</td>
                      <td className="px-3 py-3 text-slate-700">{operatorName}</td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-800">{sale.items?.length || 0}</td>
                      <td className="px-3 py-3 text-right text-slate-800">{formatCurrency(sale.discountCents || 0)}</td>
                      <td className="px-3 py-3 text-right text-slate-800">{formatCurrency(sale.taxCents || 0)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(sale.totalCents || 0)}</td>
                    </tr>
                  )
                })}
                {!sales.length && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                      No completed sales found for the selected range.
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
