import { test, describe, expect, beforeAll, afterAll } from '@jest/globals'
import axios from 'axios'

const API_URL = 'http://localhost:4000'
const api = axios.create({ baseURL: API_URL })

describe('Reports API Endpoints', () => {
  const dateFrom = '2026-02-01'
  const dateTo = '2026-03-03'

  describe('Sales Reports', () => {
    test('GET /reports/sales-summary should return daily/weekly/monthly sales', async () => {
      const response = await api.get('/reports/sales-summary', {
        params: { dateFrom, dateTo, groupBy: 'day' },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('date')
        expect(response.data[0]).toHaveProperty('revenue')
        expect(response.data[0]).toHaveProperty('sales')
      }
    })

    test('GET /reports/sales-by-product should return sales by product', async () => {
      const response = await api.get('/reports/sales-by-product', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('productName')
        expect(response.data[0]).toHaveProperty('qty')
        expect(response.data[0]).toHaveProperty('totalRevenue')
      }
    })

    test('GET /reports/sales-by-category should return sales breakdown by category', async () => {
      const response = await api.get('/reports/sales-by-category', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('category')
        expect(response.data[0]).toHaveProperty('revenue')
      }
    })

    test('GET /reports/top-products should return top selling products', async () => {
      const response = await api.get('/reports/top-products', {
        params: { limit: 10, dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBeLessThanOrEqual(10)
    })

    test('GET /reports/revenue-analysis should return revenue metrics', async () => {
      const response = await api.get('/reports/revenue-analysis', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('totalSales')
      expect(response.data).toHaveProperty('totalRevenue')
      expect(response.data).toHaveProperty('totalDiscount')
      expect(response.data).toHaveProperty('totalTax')
      expect(typeof response.data.totalRevenue).toBe('number')
    })

    test('GET /reports/payment-methods should return payment breakdown', async () => {
      const response = await api.get('/reports/payment-methods', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('method')
        expect(response.data[0]).toHaveProperty('amount')
        expect(response.data[0]).toHaveProperty('percentage')
      }
    })

    test('GET /reports/hourly-sales should return hourly breakdown', async () => {
      const response = await api.get('/reports/hourly-sales', {
        params: { date: '2026-03-03' },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBeLessThanOrEqual(24)
    })
  })

  describe('Inventory Reports', () => {
    test('GET /reports/inventory-valuation should return inventory value', async () => {
      const response = await api.get('/reports/inventory-valuation')
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('items')
      expect(response.data).toHaveProperty('totals')
      expect(response.data.totals).toHaveProperty('totalQty')
      expect(response.data.totals).toHaveProperty('totalRetailValue')
    })

    test('GET /reports/inventory-movement should return turnover data', async () => {
      const response = await api.get('/reports/inventory-movement')
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('name')
        expect(response.data[0]).toHaveProperty('turnoverRate')
        expect(response.data[0]).toHaveProperty('currentQty')
      }
    })

    test('GET /reports/low-stock should return low stock items', async () => {
      const response = await api.get('/reports/low-stock')
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      // Low stock items may be empty if no items are below threshold
      response.data.forEach((item: any) => {
        expect(item).toHaveProperty('productName')
        expect(item).toHaveProperty('currentQty')
        expect(item).toHaveProperty('minThreshold')
      })
    })
  })

  describe('Customer Reports', () => {
    test('GET /reports/customer-analytics should return customer data', async () => {
      const response = await api.get('/reports/customer-analytics', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('topCustomers')
      expect(response.data).toHaveProperty('repeatCustomers')
      expect(response.data).toHaveProperty('totalCustomers')
      expect(response.data).toHaveProperty('avgCustomerValue')
    })
  })

  describe('Financial Reports', () => {
    test('GET /reports/discounts-impact should return discount metrics', async () => {
      const response = await api.get('/reports/discounts-impact', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('byReason')
      expect(response.data).toHaveProperty('totalDiscount')
      expect(Array.isArray(response.data.byReason)).toBe(true)
    })

    test('GET /reports/profit-margins should return margin analysis', async () => {
      const response = await api.get('/reports/profit-margins', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('productName')
        expect(response.data[0]).toHaveProperty('marginPercent')
        expect(response.data[0]).toHaveProperty('revenueTotal')
      }
    })

    test('GET /reports/tax-summary should return tax data', async () => {
      const response = await api.get('/reports/tax-summary', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('totalSales')
      expect(response.data).toHaveProperty('totalTax')
      expect(response.data).toHaveProperty('totalTaxableAmount')
      expect(response.data).toHaveProperty('effectiveTaxRate')
    })
  })

  describe('Employee Reports', () => {
    test('GET /reports/employee-performance should return employee data', async () => {
      const response = await api.get('/reports/employee-performance', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      if (response.data.length > 0) {
        expect(response.data[0]).toHaveProperty('name')
        expect(response.data[0]).toHaveProperty('totalSales')
        expect(response.data[0]).toHaveProperty('transactionCount')
      }
    })
  })

  describe('Data Export', () => {
    test('GET /reports/export/csv should return CSV data', async () => {
      const response = await api.get('/reports/export/csv', {
        params: { type: 'sales-summary', dateFrom, dateTo },
        responseType: 'blob',
      })
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/csv')
    })
  })

  describe('Inventory Adjustments', () => {
    test('GET /reports/inventory-adjustments should return adjustment history', async () => {
      const response = await api.get('/reports/inventory-adjustments', {
        params: { dateFrom, dateTo },
      })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      // May be empty if no adjustments
      response.data.forEach((item: any) => {
        expect(item).toHaveProperty('productSku')
        expect(item).toHaveProperty('qtyDelta')
        expect(item).toHaveProperty('reason')
      })
    })
  })
})
