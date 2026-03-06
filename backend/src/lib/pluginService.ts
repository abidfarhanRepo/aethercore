import { Prisma, TenantProfile } from '@prisma/client'
import { prisma } from '../utils/db'

export const PROFILE_CAPABILITY_DEFAULTS: Record<TenantProfile, string[]> = {
  GENERAL: ['catalog.basic', 'inventory.core', 'payments.multi_provider', 'receipts.print'],
  SUPERMARKET: [
    'catalog.basic',
    'inventory.core',
    'inventory.expiry',
    'sales.quick_checkout',
    'promotions.advanced',
    'loyalty.program',
    'payments.multi_provider',
    'receipts.print',
  ],
  RESTAURANT: [
    'catalog.basic',
    'inventory.core',
    'restaurant.table_service',
    'restaurant.kds',
    'restaurant.menu_modifiers',
    'loyalty.program',
    'payments.multi_provider',
    'receipts.print',
  ],
  PHARMACY: [
    'catalog.basic',
    'inventory.core',
    'inventory.expiry',
    'inventory.lot_tracking',
    'pharmacy.prescription_validation',
    'pharmacy.controlled_substances',
    'pharmacy.drug_interactions',
    'payments.multi_provider',
    'receipts.print',
  ],
}

const LEGACY_SETTING_MAP: Record<string, string> = {
  'restaurant.table_service': 'feature_restaurant_enabled',
  'restaurant.kds': 'feature_kitchen_enabled',
  'pharmacy.prescription_validation': 'feature_pharmacy_enabled',
  'pharmacy.controlled_substances': 'feature_pharmacy_enabled',
  'pharmacy.drug_interactions': 'feature_pharmacy_enabled',
  'inventory.expiry': 'feature_expiry_lots_enabled',
  'inventory.lot_tracking': 'feature_expiry_lots_enabled',
  'procurement.receiving': 'feature_receiving_enabled',
}

export async function resolveTenantIdForUser(user?: { id?: string; tenantId?: string | null }): Promise<string | null> {
  if (user?.tenantId) {
    return user.tenantId
  }

  const defaultTenant = await prisma.tenant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return defaultTenant?.id || null
}

export async function isCapabilityEnabledForTenant(tenantId: string | null, capabilityKey: string): Promise<boolean> {
  if (!tenantId) {
    return false
  }

  const flag = await prisma.tenantFeatureFlag.findUnique({
    where: {
      tenantId_capabilityKey: {
        tenantId,
        capabilityKey,
      },
    },
    select: { enabled: true },
  })

  if (flag) {
    return flag.enabled
  }

  const settingKey = LEGACY_SETTING_MAP[capabilityKey]
  if (settingKey) {
    const setting = await prisma.settings.findUnique({ where: { key: settingKey }, select: { value: true } })
    if (setting) {
      return setting.value === 'true'
    }
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { profile: true } })
  if (!tenant) {
    return false
  }

  return PROFILE_CAPABILITY_DEFAULTS[tenant.profile].includes(capabilityKey)
}

export async function ensureTenantCapabilityFlag(args: {
  tenantId: string
  capabilityKey: string
  enabled: boolean
  updatedBy?: string
  sourcePluginId?: string
  config?: Record<string, unknown>
}) {
  const config = args.config as Prisma.InputJsonValue | undefined

  const capability = await prisma.pluginCapability.findUnique({
    where: { key: args.capabilityKey },
    select: { id: true },
  })

  return prisma.tenantFeatureFlag.upsert({
    where: {
      tenantId_capabilityKey: {
        tenantId: args.tenantId,
        capabilityKey: args.capabilityKey,
      },
    },
    update: {
      enabled: args.enabled,
      updatedBy: args.updatedBy,
      sourcePluginId: args.sourcePluginId,
      config,
      capabilityId: capability?.id,
    },
    create: {
      tenantId: args.tenantId,
      capabilityKey: args.capabilityKey,
      enabled: args.enabled,
      updatedBy: args.updatedBy,
      sourcePluginId: args.sourcePluginId,
      config,
      capabilityId: capability?.id,
    },
  })
}
