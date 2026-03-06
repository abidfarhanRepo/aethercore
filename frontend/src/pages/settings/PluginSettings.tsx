import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { pluginAPI, PluginItem, TenantItem, TenantFlagItem } from '@/lib/pluginAPI'

const PROFILES: TenantItem['profile'][] = ['SUPERMARKET', 'RESTAURANT', 'PHARMACY', 'GENERAL']

export default function PluginSettings() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plugins, setPlugins] = useState<PluginItem[]>([])
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [tenantDefaults, setTenantDefaults] = useState<string[]>([])
  const [tenantFlags, setTenantFlags] = useState<TenantFlagItem[]>([])

  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantCode, setNewTenantCode] = useState('')
  const [newTenantProfile, setNewTenantProfile] = useState<TenantItem['profile']>('GENERAL')

  const tenantFlagMap = useMemo(() => {
    const map = new Map<string, TenantFlagItem>()
    for (const flag of tenantFlags) {
      map.set(flag.capabilityKey, flag)
    }
    return map
  }, [tenantFlags])

  const loadCore = async () => {
    setLoading(true)
    setError(null)
    try {
      const [pluginsRes, tenantsRes] = await Promise.all([pluginAPI.listPlugins(), pluginAPI.listTenants()])
      setPlugins(pluginsRes.data.plugins)
      setTenants(tenantsRes.data.tenants)

      const preferredTenant = selectedTenantId || tenantsRes.data.tenants[0]?.id || ''
      setSelectedTenantId(preferredTenant)

      if (preferredTenant) {
        const flagsRes = await pluginAPI.listTenantFlags(preferredTenant)
        setTenantDefaults(flagsRes.data.defaults)
        setTenantFlags(flagsRes.data.flags)
      } else {
        setTenantDefaults([])
        setTenantFlags([])
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load plugin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCore()
  }, [])

  const onTenantChange = async (tenantId: string) => {
    setSelectedTenantId(tenantId)
    if (!tenantId) {
      setTenantDefaults([])
      setTenantFlags([])
      return
    }

    try {
      const flagsRes = await pluginAPI.listTenantFlags(tenantId)
      setTenantDefaults(flagsRes.data.defaults)
      setTenantFlags(flagsRes.data.flags)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load tenant flags')
    }
  }

  const createTenant = async () => {
    if (!newTenantName.trim() || !newTenantCode.trim()) {
      setError('Tenant name and code are required')
      return
    }

    try {
      setError(null)
      await pluginAPI.createTenant({
        name: newTenantName.trim(),
        code: newTenantCode.trim(),
        profile: newTenantProfile,
      })
      setNewTenantName('')
      setNewTenantCode('')
      setNewTenantProfile('GENERAL')
      await loadCore()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create tenant')
    }
  }

  const toggleCapability = async (capabilityKey: string, enabled: boolean) => {
    if (!selectedTenantId) return
    try {
      setError(null)
      await pluginAPI.updateTenantFlag(selectedTenantId, capabilityKey, enabled)
      await onTenantChange(selectedTenantId)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update capability')
    }
  }

  const setPluginEnabled = async (pluginKey: string, enabled: boolean) => {
    try {
      setError(null)
      if (enabled) {
        await pluginAPI.enablePlugin(pluginKey, selectedTenantId || undefined)
      } else {
        await pluginAPI.disablePlugin(pluginKey, selectedTenantId || undefined)
      }
      await loadCore()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update plugin')
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tenant Profiles and Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="Tenant name" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} />
            <Input placeholder="Tenant code" value={newTenantCode} onChange={(e) => setNewTenantCode(e.target.value.toUpperCase())} />
            <select
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
              value={newTenantProfile}
              onChange={(e) => setNewTenantProfile(e.target.value as TenantItem['profile'])}
            >
              {PROFILES.map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </select>
            <Button onClick={createTenant}>Create Tenant</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={selectedTenantId}
              onChange={(e) => void onTenantChange(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code}) - {tenant.profile}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => void loadCore()} disabled={loading}>Refresh</Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Profile defaults: {tenantDefaults.length > 0 ? tenantDefaults.join(', ') : 'none'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plugin Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plugins.map((plugin) => (
            <div key={plugin.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{plugin.name} ({plugin.key})</div>
                  <div className="text-xs text-muted-foreground">v{plugin.version} | {plugin.isCore ? 'Core' : 'Extension'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{plugin.description || 'No description'}</div>
                </div>
                <Button
                  variant={plugin.isEnabled ? 'outline' : 'default'}
                  onClick={() => void setPluginEnabled(plugin.key, !plugin.isEnabled)}
                >
                  {plugin.isEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {plugin.capabilities.map((capability) => {
                  const existing = tenantFlagMap.get(capability.key)
                  const enabled = existing ? existing.enabled : tenantDefaults.includes(capability.key)
                  return (
                    <label key={capability.key} className="flex items-center justify-between text-sm rounded border border-border p-2">
                      <span>{capability.key}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => void toggleCapability(capability.key, e.target.checked)}
                        disabled={!selectedTenantId}
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
