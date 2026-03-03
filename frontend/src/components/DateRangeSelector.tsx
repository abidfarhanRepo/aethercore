import React, { useState } from 'react'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'

interface DateRange {
  from: Date
  to: Date
}

interface DateRangeSelectorProps {
  onSelect: (range: DateRange) => void
  defaultRange?: 'today' | 'week' | 'month' | 'year'
}

export default function DateRangeSelector({ onSelect, defaultRange = 'month' }: DateRangeSelectorProps) {
  const today = new Date()
  const [range, setRange] = useState<DateRange>({
    from: startOfMonth(today),
    to: endOfMonth(today),
  })
  const [showCustom, setShowCustom] = useState(false)

  const handleQuickSelect = (type: string) => {
    let newRange: DateRange
    switch (type) {
      case 'today':
        newRange = { from: today, to: today }
        break
      case 'week':
        const weekStart = startOfWeek(today)
        newRange = { from: weekStart, to: today }
        break
      case 'month':
        newRange = { from: startOfMonth(today), to: endOfMonth(today) }
        break
      case 'year':
        newRange = { from: new Date(today.getFullYear(), 0, 1), to: today }
        break
      case '30days':
        newRange = { from: subDays(today, 30), to: today }
        break
      default:
        return
    }
    setRange(newRange)
    onSelect(newRange)
    setShowCustom(false)
  }

  const handleCustomDate = (field: 'from' | 'to', value: string) => {
    const date = new Date(value)
    const newRange = { ...range, [field]: date }
    setRange(newRange)
  }

  const handleApplyCustom = () => {
    onSelect(range)
    setShowCustom(false)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => handleQuickSelect('today')}
          className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 transition"
        >
          Today
        </button>
        <button
          onClick={() => handleQuickSelect('week')}
          className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 transition"
        >
          This Week
        </button>
        <button
          onClick={() => handleQuickSelect('month')}
          className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 transition"
        >
          This Month
        </button>
        <button
          onClick={() => handleQuickSelect('30days')}
          className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 transition"
        >
          Last 30 Days
        </button>
        <button
          onClick={() => handleQuickSelect('year')}
          className="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200 transition"
        >
          This Year
        </button>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-3 py-1 text-sm rounded bg-blue-100 hover:bg-blue-200 text-blue-700 transition"
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="border-t pt-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-600">From Date</label>
              <input
                type="date"
                value={format(range.from, 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDate('from', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">To Date</label>
              <input
                type="date"
                value={format(range.to, 'yyyy-MM-dd')}
                onChange={(e) => handleCustomDate('to', e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded"
              />
            </div>
          </div>
          <button
            onClick={handleApplyCustom}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
          >
            Apply
          </button>
        </div>
      )}

      <div className="text-sm text-slate-600 mt-4">
        {format(range.from, 'MMM dd, yyyy')} - {format(range.to, 'MMM dd, yyyy')}
      </div>
    </div>
  )
}
