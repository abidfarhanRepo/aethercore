import React, { useState, useEffect } from 'react'
import { salesAPI, reportsAPI, productsAPI } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package } from 'lucide-react'

export function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProducts: 0,
    avgOrderValue: 0,
    salesTrend: [],
    topProducts: [],
    revenueByHour: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch sales and reports
      const [salesRes, reportsRes, productsRes] = await Promise.all([
        salesAPI.list(),
        reportsAPI.dailySales(),
        productsAPI.list(),
      ])

      const sales = Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.sales || []
      const dailyData = Array.isArray(reportsRes.data) ? reportsRes.data : reportsRes.data?.data || []
      const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.products || []

      // Calculate stats
      const totalRevenue = sales.reduce((sum, s: any) => sum + s.totalCents, 0)
      const avgOrder = sales.length > 0 ? totalRevenue / sales.length : 0

      // Top products by sales count
      const productMap = new Map<string, { name: string; count: number }>()
      sales.forEach((sale: any) => {
        sale.items?.forEach((item: any) => {
          const current = productMap.get(item.productId) || { name: item.name || 'Unknown', count: 0 }
          productMap.set(item.productId, { ...current, count: current.count + item.qty })
        })
      })

      const topProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([_, p]) => p)

      // Revenue by hour (simulate from daily data)
      const revenueByHour = dailyData.slice(0, 24).map((item: any, idx: number) => ({
        hour: `${idx}:00`,
        revenue: (item.totalCents || 0) / 100,
      }))

      setStats({
        totalSales: sales.length,
        totalRevenue: totalRevenue / 100,
        totalProducts: products.length,
        avgOrderValue: avgOrder / 100,
        salesTrend: dailyData.map((d: any) => ({
          date: d.date || new Date().toISOString().split('T')[0],
          sales: (d.totalCents || 0) / 100,
        })),
        topProducts,
        revenueByHour,
      })
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading dashboard...</div>
  }

  const COLORS = ['#0366d6', '#28a745', '#fd7e14', '#dc3545', '#6f42c1']

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 border border-border rounded-md hover:bg-accent"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500 opacity-20" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              +12% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
              <ShoppingCart className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
              <TrendingUp className="h-4 w-4" />
              Avg: ${stats.avgOrderValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
            <div className="text-sm text-muted-foreground mt-2">Inventory</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold">${stats.avgOrderValue.toFixed(2)}</p>
              </div>
              <TrendingDown className="h-10 w-10 text-orange-500 opacity-20" />
            </div>
            <div className="text-sm text-muted-foreground mt-2">Per transaction</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#0366d6"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.revenueByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Bar dataKey="revenue" fill="#0366d6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topProducts.length === 0 ? (
              <p className="text-muted-foreground">No sales data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.topProducts}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stats.topProducts.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
