import React, { useState, useEffect } from 'react'
import DateRangeSelector from '../components/DateRangeSelector'
import ReportChart from '../components/ReportChart'
import MetricCard from '../components/MetricCard'
import { reportsAPI } from '../lib/api'

interface DateRange {
  from: Date
  to: Date
}

export default function EmployeeReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const [employees, revenue] = await Promise.all([
        reportsAPI.employeePerformance({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.revenueAnalysis({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
      ])

      setData({
        employees: employees.data,
        revenue: revenue.data,
      })
    } catch (error) {
      console.error('Failed to load employee reports:', error)
    }
    setLoading(false)
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const chartData = (data.employees || []).map((emp: any, idx: number) => ({
    name: emp.name.split(' ')[0] || `Employee ${idx + 1}`,
    sales: emp.totalSales,
    transactions: emp.transactionCount,
  }))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Employee Performance</h1>
          <p className="text-slate-600 mt-1">Sales metrics and employee rankings</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <DateRangeSelector onSelect={setDateRange} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading employee reports...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Active Employees"
                value={data.employees?.length || 0}
                variant="default"
              />
              <MetricCard
                title="Total Sales"
                value={data.revenue?.totalSales || 0}
                variant="default"
              />
              <MetricCard
                title="Avg per Employee"
                value={data.employees?.length ? Math.floor(data.revenue?.totalSales / data.employees.length) : 0}
                variant="default"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ReportChart
                type="bar"
                data={chartData}
                dataKey="sales"
                xAxisKey="name"
                title="Sales by Employee"
                height={300}
              />
              <ReportChart
                type="bar"
                data={chartData}
                dataKey="transactions"
                xAxisKey="name"
                title="Transactions by Employee"
                height={300}
              />
            </div>

            {/* Employee Performance Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Employee Performance Rankings</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900 w-12">Rank</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Employee Name</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Total Sales</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Transaction Count</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Avg per Transaction</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.employees || []).map((emp: any, idx: number) => {
                      const totalRevenue = data.revenue?.totalRevenue || 1
                      const pct = Math.round((emp.totalSales / totalRevenue) * 100)
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-6 py-4 text-slate-900 font-semibold">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-900 font-medium">{emp.name}</td>
                          <td className="px-6 py-4 text-right text-slate-900 font-semibold">{formatCurrency(emp.totalSales)}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{emp.transactionCount}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(emp.avgTransaction)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-slate-900 font-semibold w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Stats */}
            {(data.employees || []).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Performer</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Employee</span>
                      <span className="font-semibold text-slate-900">{(data.employees || [])[0]?.name}</span>
                    </div>
                    <div className="flex justify-between pb-3 border-b border-slate-200">
                      <span className="text-slate-600">Total Sales</span>
                      <span className="font-semibold text-slate-900">{formatCurrency((data.employees || [])[0]?.totalSales || 0)}</span>
                    </div>
                    <div className="flex justify-between pb-3 border-b border-slate-200">
                      <span className="text-slate-600">Transactions</span>
                      <span className="font-semibold text-slate-900">{(data.employees || [])[0]?.transactionCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Avg Transaction</span>
                      <span className="font-semibold text-slate-900">{formatCurrency((data.employees || [])[0]?.avgTransaction || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Team Avg Sales</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(data.employees?.reduce((sum: number, emp: any) => sum + emp.totalSales, 0) / Math.max(1, data.employees?.length) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-3 border-b border-slate-200">
                      <span className="text-slate-600">Team Avg Transactions</span>
                      <span className="font-semibold text-slate-900">
                        {Math.round(data.employees?.reduce((sum: number, emp: any) => sum + emp.transactionCount, 0) / Math.max(1, data.employees?.length) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between pb-3 border-b border-slate-200">
                      <span className="text-slate-600">Highest Sale</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(Math.max(...data.employees?.map((e: any) => e.totalSales) || [0]))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Lowest Sale</span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(Math.min(...data.employees?.map((e: any) => e.totalSales) || [0]))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
