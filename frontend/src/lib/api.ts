import axios from 'axios'
import { networkMonitor } from './offline/network'
import { syncEngine } from './offline/sync'
import { offlineDB } from './offline/db'

const defaultLocalProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http'

// In production default to same-origin transport to preserve HTTPS, while keeping a local fallback for development.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? window.location.origin : `${defaultLocalProtocol}://localhost:4000`)

export const API_BASE = '/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function getNetworkErrorMessage(error: any): string {
  const responseData = error?.response?.data
  const message = String(error?.message || '')
  const code = String(error?.code || '')

  const hasNoResponse = !error?.response && !!error?.request
  const hasConnectionErrorCode =
    code === 'ERR_NETWORK' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT'
  const hasConnectionErrorMessage =
    /network error|connection refused|econnrefused|timeout|timed out|err_connection_refused|err_connection_timed_out/i.test(
      message
    )

  if (hasNoResponse || hasConnectionErrorCode || hasConnectionErrorMessage) {
    return 'Backend server is not reachable. Please ensure the server is running and try again.'
  }

  return responseData?.error || responseData?.message || error?.message || 'An unexpected error occurred'
}

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>()

// Offline fallback wrapper
export const createOfflineAPI = () => {
  return {
    get: async (url: string, config?: any) => {
      const key = `GET:${url}`
      
      // Try to use cache for GET requests
      if (!networkMonitor.isConnected()) {
        try {
          // Try to get from IndexedDB cache based on endpoint
          const data = await getOfflineCache(url)
          if (data) {
            return { data, offline: true }
          }
        } catch (error) {
          console.log('Cache miss for GET:', url)
        }
      }

      // Make actual request
      try {
        const response = await api.get(url, config)
        // Cache GET responses for offline use
        if (response.data && Array.isArray(response.data)) {
          await setOfflineCache(url, response.data)
        }
        return response
      } catch (error: any) {
        if (!networkMonitor.isConnected()) {
          // Return cached data if available
          const cached = await getOfflineCache(url)
          if (cached) {
            return { data: cached, offline: true }
          }
        }
        throw error
      }
    },

    post: async (url: string, data?: any, config?: any) => {
      // Check if we should queue this request
      if (!networkMonitor.isConnected()) {
        const queueId = await syncEngine.queueOperation('POST', url, data, PriorityMap[url] || 0)
        return {
          data: { queued: true, queueId },
          status: 202,
          offline: true,
        }
      }

      try {
        return await api.post(url, data, config)
      } catch (error: any) {
        // If request fails, try to queue it for later
        if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
          const queueId = await syncEngine.queueOperation('POST', url, data, PriorityMap[url] || 0)
          return {
            data: { queued: true, queueId },
            status: 202,
            offline: true,
          }
        }
        throw error
      }
    },

    put: async (url: string, data?: any, config?: any) => {
      if (!networkMonitor.isConnected()) {
        const queueId = await syncEngine.queueOperation('PUT', url, data, PriorityMap[url] || 0)
        return {
          data: { queued: true, queueId },
          status: 202,
          offline: true,
        }
      }

      try {
        return await api.put(url, data, config)
      } catch (error: any) {
        if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
          const queueId = await syncEngine.queueOperation('PUT', url, data, PriorityMap[url] || 0)
          return {
            data: { queued: true, queueId },
            status: 202,
            offline: true,
          }
        }
        throw error
      }
    },

    delete: async (url: string, config?: any) => {
      if (!networkMonitor.isConnected()) {
        const queueId = await syncEngine.queueOperation('DELETE', url, {}, PriorityMap[url] || 0)
        return {
          data: { queued: true, queueId },
          status: 202,
          offline: true,
        }
      }

      try {
        return await api.delete(url, config)
      } catch (error: any) {
        if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
          const queueId = await syncEngine.queueOperation('DELETE', url, {}, PriorityMap[url] || 0)
          return {
            data: { queued: true, queueId },
            status: 202,
            offline: true,
          }
        }
        throw error
      }
    },
  }
}

const offlineAPI = createOfflineAPI()

// Priority map - higher priority syncs first (e.g., payments fail fast)
const PriorityMap: Record<string, number> = {
  '/api/v1/sales': 10,
  '/api/v1/payments': 50,
  '/api/v1/inventory/adjust': 20,
}

// Offline cache helpers
async function getOfflineCache(url: string): Promise<any> {
  // Map URLs to IndexedDB stores
  if (url.includes('/api/v1/products')) {
    return offlineDB.getAllProducts()
  }
  if (url.includes('/api/v1/inventory')) {
    return offlineDB.getAllInventory()
  }
  if (url.includes('/api/v1/users')) {
    return offlineDB.getAllUsers()
  }
  return null
}

async function setOfflineCache(url: string, data: any): Promise<void> {
  if (url.includes('/api/v1/products') && Array.isArray(data)) {
    await Promise.all(
      data.map((product: any) =>
        offlineDB.saveProduct({
          ...product,
          version: 1,
          lastSyncedAt: Date.now(),
        })
      )
    )
  } else if (url.includes('/api/v1/inventory') && Array.isArray(data)) {
    await Promise.all(
      data.map((inventory: any) =>
        offlineDB.saveInventoryLevel({
          ...inventory,
          version: 1,
          lastSyncedAt: Date.now(),
        })
      )
    )
  } else if (url.includes('/api/v1/users') && Array.isArray(data)) {
    await Promise.all(
      data.map((user: any) =>
        offlineDB.saveUser({
          ...user,
          version: 1,
          lastSyncedAt: Date.now(),
        })
      )
    )
  }
}

// Auth API
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/api/v1/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),
  enrollMfa: () => api.post('/api/v1/auth/mfa/enroll', {}),
  verifyMfa: (token: string) => api.post('/api/v1/auth/mfa/verify', { token }),
  completeMfaChallenge: (payload: { tempSessionToken: string; token?: string; recoveryCode?: string }) =>
    api.post('/api/v1/auth/mfa/challenge', payload),
  getMfaStatus: () =>
    api.get<{ mfaEnabled: boolean; recoveryCodesRemaining: number; recoveryCodes: string[] }>('/api/v1/auth/mfa/status'),
  getRecoveryCodes: () => api.get<{ recoveryCodes: string[] }>('/api/v1/auth/mfa/recovery-codes'),
  resetMfa: () => api.post('/api/v1/auth/mfa/reset', {}),
  verifyPin: (pin: string) => api.post<{ verified: boolean }>('/api/v1/auth/verify-pin', { pin }),
  refresh: (refreshToken: string) =>
    api.post('/api/v1/auth/refresh', { refreshToken }),
  revoke: (refreshToken: string) =>
    api.post('/api/v1/auth/logout', { refreshToken }),
  getMe: () => api.get('/api/v1/auth/me'),
}

// Products API
export const productsAPI = {
  list: () => api.get('/api/v1/products'),
  get: (id: string) => api.get(`/api/v1/products/${id}`),
  create: (data: any) => api.post('/api/v1/products', data),
  update: (id: string, data: any) => api.put(`/api/v1/products/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/products/${id}`),
  search: (query: string) => api.get('/api/v1/products', { params: { q: query } }),
}

// Sales API
export const salesAPI = {
  create: (data: any) => offlineAPI.post('/api/v1/sales', data),
  get: (id: string) => api.get(`/api/v1/sales/${id}`),
  list: (filters?: any) => api.get('/api/v1/sales', { params: filters }),
  refund: (id: string, data: any) => api.post(`/api/v1/sales/${id}/refund`, data),
  return: (id: string, data: any) => api.post(`/api/v1/sales/${id}/return`, data),
  void: (id: string, data: any) => api.post(`/api/v1/sales/${id}/void`, data),
  analytics: (filters?: any) => api.get('/api/v1/sales/analytics/summary', { params: filters }),
}

// Inventory API
export const inventoryAPI = {
  list: () => api.get('/api/v1/inventory'),
  get: (productId: string) => api.get(`/api/v1/inventory/${productId}`),
  adjust: (productId: string, warehouseId: string, qtyDelta: number, reason?: string, notes?: string, costPerUnit?: number) =>
    api.post('/api/v1/inventory/adjust', { productId, warehouseId, qtyDelta, reason, notes, costPerUnit }),
  transfer: (productId: string, fromWarehouseId: string, toWarehouseId: string, qty: number, notes?: string) =>
    api.post('/api/v1/inventory/transfer', { productId, fromWarehouseId, toWarehouseId, qty, notes }),
  getLowStock: () => api.get('/api/v1/inventory/low-stock'),
  recount: (warehouseId: string, sessionName: string, items: any[]) =>
    api.post('/api/v1/inventory/recount', { warehouseId, sessionName, items }),
  getWarehouses: () => api.get('/api/v1/inventory/warehouses'),
  initWarehouse: () => api.post('/api/v1/inventory/warehouse/init', {}),
}

// Purchases API
export const purchasesAPI = {
  create: (data: any) => api.post('/api/v1/purchases', data),
  get: (id: string) => api.get(`/api/v1/purchases/${id}`),
  list: () => api.get('/api/v1/purchases'),
  receive: (id: string, data: any) => api.post(`/api/v1/purchases/${id}/receive`, data),
}

// Reports API
export const reportsAPI = {
  dailySales: (query?: any) => api.get('/api/v1/reports/daily-sales', { params: query }),
  inventoryValuation: () => api.get('/api/v1/reports/inventory-valuation'),
  salesSummary: (query?: any) => api.get('/api/v1/reports/sales-summary', { params: query }),
  salesByProduct: (query?: any) => api.get('/api/v1/reports/sales-by-product', { params: query }),
  salesByCategory: (query?: any) => api.get('/api/v1/reports/sales-by-category', { params: query }),
  topProducts: (query?: any) => api.get('/api/v1/reports/top-products', { params: query }),
  revenueAnalysis: (query?: any) => api.get('/api/v1/reports/revenue-analysis', { params: query }),
  inventoryMovement: () => api.get('/api/v1/reports/inventory-movement'),
  lowStock: () => api.get('/api/v1/reports/low-stock'),
  customerAnalytics: (query?: any) => api.get('/api/v1/reports/customer-analytics', { params: query }),
  paymentMethods: (query?: any) => api.get('/api/v1/reports/payment-methods', { params: query }),
  discountsImpact: (query?: any) => api.get('/api/v1/reports/discounts-impact', { params: query }),
  employeePerformance: (query?: any) => api.get('/api/v1/reports/employee-performance', { params: query }),
  profitMargins: (query?: any) => api.get('/api/v1/reports/profit-margins', { params: query }),
  taxSummary: (query?: any) => api.get('/api/v1/reports/tax-summary', { params: query }),
  hourlySales: (query?: any) => api.get('/api/v1/reports/hourly-sales', { params: query }),
  inventoryAdjustments: (query?: any) => api.get('/api/v1/reports/inventory-adjustments', { params: query }),
  visibleSales: (query?: any) => api.get('/api/v1/reports/sales/visible', { params: query }),
  visibleSaleById: (id: string) => api.get(`/api/v1/reports/sales/${id}/visible`),
  visiblePurchases: (query?: any) => api.get('/api/v1/reports/purchases/visible', { params: query }),
  visiblePurchaseById: (id: string) => api.get(`/api/v1/reports/purchases/${id}/visible`),
  purchaseRecommendations: (query?: any) => api.get('/api/v1/reports/intelligence/purchase-recommendations', { params: query }),
  intelligenceKpis: (query?: any) => api.get('/api/v1/reports/intelligence/kpis', { params: query }),
  exportCSV: (type: string, query?: any) => api.get(`/api/v1/reports/export/csv?type=${type}`, { params: query, responseType: 'blob' }),
}

// Audit API
export const auditAPI = {
  list: (query?: any) => api.get('/api/v1/audits', { params: query }),
}

// Users API
export const usersAPI = {
  list: (filters?: any) => api.get('/api/v1/users', { params: filters }),
  get: (id: string) => api.get(`/api/v1/users/${id}`),
  create: (data: any) => api.post('/api/v1/users', data),
  update: (id: string, data: any) => api.put(`/api/v1/users/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/users/${id}`),
  changePassword: (id: string, data: any) => api.post(`/api/v1/users/${id}/change-password`, data),
  resetPassword: (id: string) => api.post(`/api/v1/users/${id}/reset-password`, {}),
  resetMfa: (id: string) => api.post(`/api/v1/users/${id}/mfa/reset`, {}),
  setPin: (id: string, pin: string) => api.put(`/api/v1/users/${id}/pin`, { pin }),
  unlock: (id: string) => api.post(`/api/v1/users/${id}/unlock`, {}),
  updateRoles: (id: string, customRoleIds: string[]) => api.put(`/api/v1/users/${id}/roles`, { customRoleIds }),
  getAuditLog: (id: string, limit?: number, offset?: number) =>
    api.get(`/api/v1/users/${id}/audit-log`, { params: { limit, offset } }),
}

// Roles API
export const rolesAPI = {
  list: (filters?: any) => api.get('/api/v1/roles', { params: filters }),
  get: (id: string) => api.get(`/api/v1/roles/${id}`),
  create: (data: any) => api.post('/api/v1/roles', data),
  update: (id: string, data: any) => api.put(`/api/v1/roles/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/roles/${id}`),
}

// Permission Log API
export const permissionAPI = {
  list: (filters?: any) => api.get('/api/v1/audit/permissions', { params: filters }),
}

export default api
