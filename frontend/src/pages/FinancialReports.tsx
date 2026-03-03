import React, { useState, useEffect } from 'react'
import DateRangeSelector from '../components/DateRangeSelector'
import ReportChart from '../components/ReportChart'
import MetricCard from '../components/MetricCard'
import { reportsAPI } from '../lib/api'

interface DateRange {
  from: Date
  to: Date
}

export default function FinancialReports() {
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
      const [revenue, margins, discounts, tax, sales] = await Promise.all([
        reportsAPI.revenueAnalysis({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.profitMargins({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.discountsImpact({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.taxSummary({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.salesSummary({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
          groupBy: 'day',
        }),
      ])

      setData({
        revenue: revenue.data,
        margins: margins.data,
        discounts: discounts.data,
        tax: tax.data,
        sales: sales.data,
      })
    } catch (error) {
      console.error('Failed to load financial reports:', error)
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
          <h1 className="text-3xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-600 mt-1">Revenue, profit, and cost analysis</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <DateRangeSelector onSelect={setDateRange} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading financial reports...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Key Financial Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Revenue"
                value={formatCurrency(data.revenue?.totalRevenue || 0)}
                variant="success"
              />
              <MetricCard
                title="Cost of Goods"
                value={formatCurrency(100000)} // Would come from cost calculations
                variant="default"
              />
              <MetricCard
                title="Gross Profit"
                value={formatCurrency((data.revenue?.totalRevenue || 0) - 100000)}
                variant="success"
              />
              <MetricCard
                title="Net Revenue"
                value={formatCurrency((data.revenue?.totalRevenue || 0) - (data.revenue?.totalDiscount || 0))}
                variant="success"
              />
            </div>

            {/* Revenue vs Cost Comparison */}
            <ReportChart
              type="line"
              data={data.sales || []}
              dataKey={['revenue', 'tax']}
              xAxisKey="date"
              title="Revenue & Tax Over Time"
              height={350}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Discount Impact */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Discount Impact</h3>
                <div className="space-y-4">
                  <div className="flex justify-between pb-3 border-b border-slate-200">
                    <span className="text-slate-600">Total Discount Applied</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(data.discounts?.totalDiscount || 0)}</span>
                  </div>
                  {(data.discounts?.byReason || []).map((discount: any, idx: number) => (
                    <div key={idx} className="flex justify-between pb-3 border-b border-slate-100 last:border-0">
                      <span className="text-slate-600">{discount.reason}</span>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{formatCurrency(discount.amount)}</div>
                        <div className="text-xs text-slate-500">{discount.count} times</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax Summary */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Tax Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between pb-3 border-b border-slate-200">
                    <span className="text-slate-600">Total Transactions</span>
                    <span className="font-semibold text-slate-900">{data.tax?.totalSales || 0}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-slate-200">
                    <span className="text-slate-600">Total Tax Collected</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(data.tax?.totalTax || 0)}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-slate-200">
                    <span className="text-slate-600">Taxable Amount</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(data.tax?.totalTaxableAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Effective Tax Rate</span>
                    <span className="font-semibold text-slate-900">{data.tax?.effectiveTaxRate || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profit Margins by Product */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Profit Margins by Product</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">SKU</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Cost</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Price</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Units Sold</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Total Revenue</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Total Cost</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.margins || []).slice(0, 20).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-900 font-medium">{item.productName}</td>
                        <td className="px-6 py-3 text-slate-600">{item.sku}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(item.cost)}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{item.units}</td>
                        <td className="px-6 py-3 text-right text-slate-900 font-semibold">{formatCurrency(item.revenueTotal)}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{formatCurrency(item.costTotal)}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            item.marginPercent > 40 ? 'bg-green-100 text-green-800' :
                            item.marginPercent > 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {item.marginPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Breakdown */}
            <ReportChart
              type="bar"
              data={data.sales || []}
              dataKey={['revenue', 'discount', 'tax']}
              xAxisKey="date"
              title="Daily Revenue Breakdown"
              height={300}
            />
          </div>
        )}
      </div>
    </div>
  )
}
