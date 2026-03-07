import { api } from './api'

export interface PluginCapability {
  key: string
  name: string
  description?: string
  isDefault: boolean
}

export interface PluginItem {
  id: string
  key: string
  name: string
  version: string
  description?: string
  isCore: boolean
  isEnabled: boolean
  isActive: boolean
  capabilities: PluginCapability[]
}

export interface TenantItem {
  id: string
  code: string
  name: string
  profile: 'SUPERMARKET' | 'RESTAURANT' | 'PHARMACY' | 'GENERAL'
  isActive: boolean
}

export interface TenantFlagItem {
  id: string
  capabilityKey: string
  enabled: boolean
  sourcePluginId?: string | null
  updatedAt: string
}

export const pluginAPI = {
  listPlugins: () => api.get<{ plugins: PluginItem[] }>('/api/v1/plugins'),
  listTenants: () => api.get<{ tenants: TenantItem[] }>('/api/v1/plugins/tenants'),
  createTenant: (payload: { name: string; code: string; profile: TenantItem['profile'] }) =>
    api.post<TenantItem>('/api/v1/plugins/tenants', payload),
  listTenantFlags: (tenantId: string) =>
    api.get<{
      tenant: TenantItem
      defaults: string[]
      flags: TenantFlagItem[]
    }>(`/api/v1/plugins/tenants/${tenantId}/feature-flags`),
  updateTenantFlag: (tenantId: string, capabilityKey: string, enabled: boolean) =>
    api.put<TenantFlagItem>(`/api/v1/plugins/tenants/${tenantId}/feature-flags/${encodeURIComponent(capabilityKey)}`, {
      enabled,
    }),
  enablePlugin: (pluginKey: string, tenantId?: string) =>
    api.post(`/api/v1/plugins/${pluginKey}/enable`, tenantId ? { tenantId } : {}),
  disablePlugin: (pluginKey: string, tenantId?: string) =>
    api.post(`/api/v1/plugins/${pluginKey}/disable`, tenantId ? { tenantId } : {}),
}
