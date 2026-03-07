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

export interface SettingUpdatePayload {
  value: string | number | boolean
  category?: string
  type?: 'string' | 'number' | 'boolean' | 'json'
  label?: string
  description?: string
  isEncrypted?: boolean
}

export const settingsAPI = {
  // Settings
  getAll: () => api.get<Record<string, Setting[]>>('/api/v1/settings'),
  getByKey: (key: string) => api.get<Setting>(`/api/v1/settings/${key}`),
  getByCategory: (category: string) => api.get<Setting[]>(`/api/v1/settings/category/${category}`),
  update: (key: string, payload: SettingUpdatePayload) =>
    api.put<Setting>(`/api/v1/settings/${key}`, payload),
  batchUpdate: (settings: Array<{ key: string; value: string | number | boolean }>) =>
    api.post<{ results: Array<{ key: string; success: boolean; data?: Setting; error?: string }> }>(
      '/api/v1/settings/batch',
      { settings }
    ),
  create: (data: Omit<Setting, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Setting>('/api/v1/settings', data),
  delete: (key: string) => api.delete(`/api/v1/settings/${key}`),

  // Tax Rates
  getTaxRates: () => api.get<TaxRate[]>('/api/v1/settings/tax-rates'),
  getTaxRate: (id: string) => api.get<TaxRate>(`/api/v1/settings/tax-rates/${id}`),
  createTaxRate: (data: Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<TaxRate>('/api/v1/settings/tax-rates', data),
  updateTaxRate: (id: string, data: Partial<Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>>) =>
    api.put<TaxRate>(`/api/v1/settings/tax-rates/${id}`, data),
  deleteTaxRate: (id: string) => api.delete(`/api/v1/settings/tax-rates/${id}`),

  // Tax Exemptions
  getTaxExemptions: () => api.get<TaxExemption[]>('/api/v1/settings/tax-exemptions'),
  createTaxExemption: (data: Omit<TaxExemption, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) =>
    api.post<TaxExemption>('/api/v1/settings/tax-exemptions', data),
  deleteTaxExemption: (id: string) => api.delete(`/api/v1/settings/tax-exemptions/${id}`),
}
