import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import DateRangeSelector from '../components/DateRangeSelector'
import MetricCard from '../components/MetricCard'
import ExportButtons from '../components/ExportButtons'
import ReportChart from '../components/ReportChart'
import { reportsAPI } from '../lib/api'
import { BarChart3, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react'

interface DateRange {
  from: Date
  to: Date
}

export default function ReportsCenter() {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>({})

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const [revenue, sales, topProducts, customers, payment, inventory] = await Promise.all([
        reportsAPI.revenueAnalysis({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.salesSummary({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
          groupBy: 'day',
        }),
        reportsAPI.topProducts({
          limit: 5,
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.customerAnalytics({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.paymentMethods({
          dateFrom: dateRange.from.toISOString().split('T')[0],
          dateTo: dateRange.to.toISOString().split('T')[0],
        }),
        reportsAPI.inventoryValuation(),
      ])

      setData({ revenue: revenue.data, sales: sales.data, topProducts: topProducts.data, customers: customers.data, payment: payment.data, inventory: inventory.data })
    } catch (error) {
      console.error('Failed to load reports:', error)
    }
    setLoading(false)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'inventory', label: 'Inventory', icon: AlertCircle },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'financial', label: 'Financial', icon: DollarSign },
  ]

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
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">Monitor your business performance and metrics</p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <DateRangeSelector onSelect={setDateRange} />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 -mb-0.5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading reports...</div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Total Revenue"
                    value={formatCurrency(data.revenue?.totalRevenue || 0)}
                    variant="success"
                  />
                  <MetricCard
                    title="Total Transactions"
                    value={data.revenue?.totalSales || 0}
                    variant="default"
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

                <ReportChart
                  type="line"
                  data={data.sales || []}
                  dataKey="revenue"
                  xAxisKey="date"
                  title="Daily Revenue Trend"
                  height={300}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Products</h3>
                    <div className="space-y-3">
                      {(data.topProducts || []).slice(0, 5).map((product: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0">
                          <div>
                            <p className="font-medium text-slate-900">{product.name}</p>
                            <p className="text-sm text-slate-500">{product.qty} units sold</p>
                          </div>
                          <span className="font-semibold text-slate-900">#{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Methods</h3>
                    <ReportChart
                      type="pie"
                      data={data.payment || []}
                      dataKey="amount"
                      title=""
                      height={250}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <div className="space-y-8">
                <ExportButtons reportType="sales-summary" dateFrom={dateRange.from} dateTo={dateRange.to} />
                <ReportChart
                  type="line"
                  data={data.sales || []}
                  dataKey="revenue"
                  xAxisKey="date"
                  title="Revenue Over Time"
                />
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <MetricCard
                    title="Inventory Value"
                    value={formatCurrency(data.inventory?.totals?.totalRetailValue || 0)}
                    variant="success"
                  />
                  <MetricCard
                    title="Total Items"
                    value={data.inventory?.totals?.totalQty || 0}
                    variant="default"
                  />
                </div>
              </div>
            )}

            {/* Customers Tab */}
            {activeTab === 'customers' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard
                    title="Top Customers"
                    value={data.customers?.topCustomers?.length || 0}
                    variant="default"
                  />
                  <MetricCard
                    title="Repeat Rate"
                    value={`${Math.round((data.customers?.repeatCustomers / Math.max(1, data.customers?.totalCustomers)) * 100)}%`}
                    variant="success"
                  />
                  <MetricCard
                    title="Avg Customer Value"
                    value={formatCurrency(data.customers?.avgCustomerValue || 0)}
                    variant="default"
                  />
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Customers</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Customer</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Transactions</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Total Spent</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Segment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.customers?.topCustomers || []).map((customer: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0">
                            <td className="py-3 px-4 text-slate-900">{customer.name}</td>
                            <td className="py-3 px-4 text-slate-600">{customer.transactions}</td>
                            <td className="py-3 px-4 text-slate-900 font-semibold">{formatCurrency(customer.totalSpent)}</td>
                            <td className="py-3 px-4">
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {customer.segment}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard
                    title="Total Revenue"
                    value={formatCurrency(data.revenue?.totalRevenue || 0)}
                    variant="success"
                  />
                  <MetricCard
                    title="Total Tax"
                    value={formatCurrency(data.revenue?.totalTax || 0)}
                    variant="default"
                  />
                  <MetricCard
                    title="Total Discount"
                    value={formatCurrency(data.revenue?.totalDiscount || 0)}
                    variant="warning"
                  />
                  <MetricCard
                    title="Net Revenue"
                    value={formatCurrency((data.revenue?.totalRevenue || 0) - (data.revenue?.totalDiscount || 0))}
                    variant="success"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ReportChart
                    type="bar"
                    data={data.sales || []}
                    dataKey="tax"
                    xAxisKey="date"
                    title="Daily Tax Collected"
                  />
                  <ReportChart
                    type="bar"
                    data={data.sales || []}
                    dataKey="discount"
                    xAxisKey="date"
                    title="Daily Discount Applied"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
