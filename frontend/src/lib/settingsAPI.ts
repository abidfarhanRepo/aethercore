import { api } from './api'

export interface Setting {
  id: string
  key: string
  value: string
  category: string
  type: 'string' | 'number' | 'boolean' | 'json'
  label?: string
  description?: string
  isEncrypted: boolean
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface TaxRate {
  id: string
  name: string
  rate: number
  location?: string
  description?: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface TaxExemption {
  id: string
  category?: string
  productId?: string
  reason: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const settingsAPI = {
  // Settings
  getAll: () => api.get<Record<string, Setting[]>>('/api/settings'),
  getByKey: (key: string) => api.get<Setting>(`/api/settings/${key}`),
  getByCategory: (category: string) => api.get<Setting[]>(`/api/settings/category/${category}`),
  update: (key: string, value: string | number | boolean) =>
    api.put<Setting>(`/api/settings/${key}`, { value }),
  batchUpdate: (settings: Array<{ key: string; value: string | number | boolean }>) =>
    api.post<{ results: Array<{ key: string; success: boolean; data?: Setting; error?: string }> }>(
      '/api/settings/batch',
      { settings }
    ),
  create: (data: Omit<Setting, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Setting>('/api/settings', data),
  delete: (key: string) => api.delete(`/api/settings/${key}`),

  // Tax Rates
  getTaxRates: () => api.get<TaxRate[]>('/api/settings/tax-rates'),
  getTaxRate: (id: string) => api.get<TaxRate>(`/api/settings/tax-rates/${id}`),
  createTaxRate: (data: Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<TaxRate>('/api/settings/tax-rates', data),
  updateTaxRate: (id: string, data: Partial<Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>>) =>
    api.put<TaxRate>(`/api/settings/tax-rates/${id}`, data),
  deleteTaxRate: (id: string) => api.delete(`/api/settings/tax-rates/${id}`),

  // Tax Exemptions
  getTaxExemptions: () => api.get<TaxExemption[]>('/api/settings/tax-exemptions'),
  createTaxExemption: (data: Omit<TaxExemption, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) =>
    api.post<TaxExemption>('/api/settings/tax-exemptions', data),
  deleteTaxExemption: (id: string) => api.delete(`/api/settings/tax-exemptions/${id}`),
}
