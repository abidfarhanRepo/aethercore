import React, { useState, useEffect } from 'react'
import DateRangeSelector from '../components/DateRangeSelector'
import ReportChart from '../components/ReportChart'
import ExportButtons from '../components/ExportButtons'
import MetricCard from '../components/MetricCard'
import { reportsAPI } from '../lib/api'

interface DateRange {
  from: Date
  to: Date
}

export default function SalesReports() {
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
      const [summary, byProduct, byCategory, topProducts, payments, revenue] = await Promise.all([
        reportsAPI.salesSummary({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
          groupBy: 'day',
        }),
        reportsAPI.salesByProduct({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.salesByCategory({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.topProducts({
          limit: 10,
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.paymentMethods({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.revenueAnalysis({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
      ])

      setData({
        summary: summary.data,
        byProduct: byProduct.data,
        byCategory: byCategory.data,
        topProducts: topProducts.data,
        payments: payments.data,
        revenue: revenue.data,
      })
    } catch (error) {
      console.error('Failed to load sales reports:', error)
    }
    setLoading(false)
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Sales Reports</h1>
          <p className="text-slate-600 mt-1">Detailed sales analysis and metrics</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <DateRangeSelector onSelect={setDateRange} />
        </div>

        {/* Export Buttons */}
        <div className="mb-8">
          <ExportButtons reportType="sales-summary" dateFrom={dateRange.from} dateTo={dateRange.to} />
        </div>

        {/* Key Metrics */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Total Sales"
              value={data.revenue?.totalSales || 0}
              variant="default"
            />
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(data.revenue?.totalRevenue || 0)}
              variant="success"
            />
            <MetricCard
              title="Avg Transaction"
              value={formatCurrency(data.revenue?.avgTransaction || 0)}
              variant="default"
            />
            <MetricCard
              title="Total Discount"
              value={formatCurrency(data.revenue?.totalDiscount || 0)}
              variant="warning"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading reports...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Sales Summary Chart */}
            <ReportChart
              type="line"
              data={data.summary || []}
              dataKey={['revenue', 'discount']}
              xAxisKey="date"
              title="Sales Summary by Day"
              height={350}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sales by Category */}
              <ReportChart
                type="pie"
                data={data.byCategory || []}
                dataKey="revenue"
                title="Sales by Category"
                height={300}
              />

              {/* Payment Methods */}
              <ReportChart
                type="pie"
                data={data.payments || []}
                dataKey="amount"
                title="Payment Methods"
                height={300}
              />
            </div>

            {/* Top Products */}
            <ReportChart
              type="bar"
              data={data.topProducts || []}
              dataKey="qty"
              xAxisKey="name"
              title="Top 10 Products by Sales"
              height={300}
            />

            {/* Sales by Product Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Sales by Product</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">SKU</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Category</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Quantity</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Revenue</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.byProduct || []).slice(0, 20).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-900 font-medium">{item.productName}</td>
                        <td className="px-6 py-3 text-slate-600">{item.sku}</td>
                        <td className="px-6 py-3 text-slate-600">{item.category}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{item.qty}</td>
                        <td className="px-6 py-3 text-right text-slate-900 font-semibold">{formatCurrency(item.totalRevenue)}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(item.avgUnitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
