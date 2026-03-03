import React, { useState, useEffect } from 'react'
import MetricCard from '../components/MetricCard'
import { reportsAPI } from '../lib/api'
import { AlertTriangle } from 'lucide-react'

export default function InventoryReports() {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [valuation, movement, lowStock] = await Promise.all([
        reportsAPI.inventoryValuation(),
        reportsAPI.inventoryMovement(),
        reportsAPI.lowStock(),
      ])

      setData({
        valuation: valuation.data,
        movement: movement.data,
        lowStock: lowStock.data,
      })
    } catch (error) {
      console.error('Failed to load inventory reports:', error)
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
          <h1 className="text-3xl font-bold text-slate-900">Inventory Reports</h1>
          <p className="text-slate-600 mt-1">Monitor stock levels and valuations</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading inventory reports...</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Total Inventory Value"
                value={formatCurrency(data.valuation?.totals?.totalRetailValue || 0)}
                variant="success"
              />
              <MetricCard
                title="Cost Value"
                value={formatCurrency(data.valuation?.totals?.totalCostValue || 0)}
                variant="default"
              />
              <MetricCard
                title="Total Items"
                value={data.valuation?.totals?.totalQty || 0}
                variant="default"
              />
            </div>

            {/* Low Stock Alerts */}
            {(data.lowStock || []).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900">{data.lowStock.length} Items Low on Stock</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-red-200">
                        <th className="text-left py-2 px-4 font-semibold text-red-900">Product</th>
                        <th className="text-left py-2 px-4 font-semibold text-red-900">Warehouse</th>
                        <th className="text-left py-2 px-4 font-semibold text-red-900">Current</th>
                        <th className="text-left py-2 px-4 font-semibold text-red-900">Min Threshold</th>
                        <th className="text-left py-2 px-4 font-semibold text-red-900">Shortage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-red-100">
                          <td className="py-2 px-4 text-red-900 font-medium">{item.productName}</td>
                          <td className="py-2 px-4 text-red-700">{item.warehouseName}</td>
                          <td className="py-2 px-4 text-red-700">{item.currentQty}</td>
                          <td className="py-2 px-4 text-red-700">{item.minThreshold}</td>
                          <td className="py-2 px-4 text-red-900 font-semibold">{item.shortage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inventory Movement */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Inventory Movement (90 Days)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">SKU</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Current Qty</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Inbound</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Outbound</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Turnover Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.movement || []).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-900 font-medium">{item.name}</td>
                        <td className="px-6 py-3 text-slate-600">{item.sku}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{item.currentQty}</td>
                        <td className="px-6 py-3 text-right text-green-600 font-medium">+{item.inbound90Days}</td>
                        <td className="px-6 py-3 text-right text-red-600 font-medium">-{item.outbound90Days}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            item.turnoverRate > 0.7 ? 'bg-green-100 text-green-800' :
                            item.turnoverRate > 0.3 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {(item.turnoverRate * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Valuation */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Inventory by Product</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">SKU</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Quantity</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Cost Value</th>
                      <th className="px-6 py-3 text-right font-semibold text-slate-900">Retail Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.valuation?.items || []).slice(0, 30).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-6 py-3 text-slate-900 font-medium">{item.name}</td>
                        <td className="px-6 py-3 text-slate-600">{item.sku}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{item.qty}</td>
                        <td className="px-6 py-3 text-right text-slate-900">{formatCurrency(item.costValue)}</td>
                        <td className="px-6 py-3 text-right text-slate-900 font-semibold">{formatCurrency(item.retailValue)}</td>
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
