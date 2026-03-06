const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const PLUGINS = [
  { key: 'core-auth', name: 'Core Auth', version: '1.0.0', isCore: true, description: 'Authentication and access control' },
  { key: 'core-products', name: 'Core Products', version: '1.0.0', isCore: true, description: 'Product catalog management' },
  { key: 'core-sales', name: 'Core Sales', version: '1.0.0', isCore: true, description: 'Checkout and sales lifecycle' },
  { key: 'core-inventory', name: 'Core Inventory', version: '1.0.0', isCore: true, description: 'Inventory and stock movement' },
  { key: 'supermarket-expiry', name: 'Supermarket Expiry', version: '1.0.0', isCore: false, description: 'Lot and expiry management' },
  { key: 'restaurant-tables', name: 'Restaurant Tables', version: '1.0.0', isCore: false, description: 'Table workflow and states' },
  { key: 'restaurant-kitchen', name: 'Restaurant Kitchen', version: '1.0.0', isCore: false, description: 'Kitchen ticket lifecycle' },
  { key: 'pharmacy-prescriptions', name: 'Pharmacy Prescriptions', version: '1.0.0', isCore: false, description: 'Prescription validation and fills' },
  { key: 'pharmacy-interactions', name: 'Pharmacy Interactions', version: '1.0.0', isCore: false, description: 'Drug interaction checks' },
  { key: 'pharmacy-controlled', name: 'Pharmacy Controlled', version: '1.0.0', isCore: false, description: 'Controlled substance constraints' },
  { key: 'procurement-receiving', name: 'Procurement Receiving', version: '1.0.0', isCore: false, description: 'Receiving and discrepancy handling' },
]

const CAPABILITIES = [
  { pluginKey: 'core-products', key: 'catalog.basic', name: 'Basic Catalog', isDefault: true },
  { pluginKey: 'core-inventory', key: 'inventory.core', name: 'Core Inventory', isDefault: true },
  { pluginKey: 'supermarket-expiry', key: 'inventory.expiry', name: 'Expiry Tracking', isDefault: false },
  { pluginKey: 'supermarket-expiry', key: 'inventory.lot_tracking', name: 'Lot Tracking', isDefault: false },
  { pluginKey: 'core-sales', key: 'sales.quick_checkout', name: 'Quick Checkout', isDefault: true },
  { pluginKey: 'restaurant-tables', key: 'restaurant.table_service', name: 'Restaurant Table Service', isDefault: false },
  { pluginKey: 'restaurant-kitchen', key: 'restaurant.kds', name: 'Kitchen Display', isDefault: false },
  { pluginKey: 'restaurant-kitchen', key: 'restaurant.menu_modifiers', name: 'Menu Modifiers', isDefault: false },
  { pluginKey: 'pharmacy-prescriptions', key: 'pharmacy.prescription_validation', name: 'Prescription Validation', isDefault: false },
  { pluginKey: 'pharmacy-controlled', key: 'pharmacy.controlled_substances', name: 'Controlled Substance Rules', isDefault: false },
  { pluginKey: 'pharmacy-interactions', key: 'pharmacy.drug_interactions', name: 'Drug Interaction Rules', isDefault: false },
  { pluginKey: 'core-sales', key: 'promotions.advanced', name: 'Advanced Promotions', isDefault: false },
  { pluginKey: 'core-sales', key: 'loyalty.program', name: 'Loyalty Program', isDefault: false },
  { pluginKey: 'core-sales', key: 'payments.multi_provider', name: 'Multi-provider Payments', isDefault: true },
  { pluginKey: 'core-sales', key: 'receipts.print', name: 'Receipt Printing', isDefault: true },
  { pluginKey: 'core-sales', key: 'receipts.email_sms', name: 'Email/SMS Receipts', isDefault: false },
  { pluginKey: 'procurement-receiving', key: 'procurement.receiving', name: 'Procurement Receiving', isDefault: false },
]

const PROFILE_DEFAULTS = {
  SUPERMARKET: [
    'catalog.basic', 'inventory.core', 'inventory.expiry', 'sales.quick_checkout', 'promotions.advanced', 'loyalty.program', 'payments.multi_provider', 'receipts.print', 'procurement.receiving',
  ],
  RESTAURANT: [
    'catalog.basic', 'inventory.core', 'restaurant.table_service', 'restaurant.kds', 'restaurant.menu_modifiers', 'loyalty.program', 'payments.multi_provider', 'receipts.print',
  ],
  PHARMACY: [
    'catalog.basic', 'inventory.core', 'inventory.expiry', 'inventory.lot_tracking', 'pharmacy.prescription_validation', 'pharmacy.controlled_substances', 'pharmacy.drug_interactions', 'payments.multi_provider', 'receipts.print',
  ],
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aether.dev' },
    update: {},
    create: {
      email: 'admin@aether.dev',
      password: passwordHash,
      role: 'ADMIN'
    }
  })

  const p1 = await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      sku: 'SKU-001',
      name: 'Sample Product 1',
      description: 'Demo product',
      priceCents: 1000,
      costCents: 600
    }
  })

  const tenants = {}
  for (const profile of ['SUPERMARKET', 'RESTAURANT', 'PHARMACY']) {
    const code = profile
    const tenant = await prisma.tenant.upsert({
      where: { code },
      update: { isActive: true, profile },
      create: {
        code,
        name: `${profile.charAt(0)}${profile.slice(1).toLowerCase()} Default Tenant`,
        profile,
      },
    })
    tenants[profile] = tenant
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { tenantId: tenants.SUPERMARKET.id },
  })

  const pluginByKey = {}
  for (const plugin of PLUGINS) {
    pluginByKey[plugin.key] = await prisma.plugin.upsert({
      where: { key: plugin.key },
      update: {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        isCore: plugin.isCore,
        isActive: true,
      },
      create: {
        key: plugin.key,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        isCore: plugin.isCore,
        isEnabled: true,
        isActive: true,
        manifest: {
          name: plugin.key,
          version: plugin.version,
          capabilities: CAPABILITIES.filter((item) => item.pluginKey === plugin.key).map((item) => item.key),
        },
      },
    })
  }

  for (const capability of CAPABILITIES) {
    const plugin = pluginByKey[capability.pluginKey]
    await prisma.pluginCapability.upsert({
      where: { key: capability.key },
      update: {
        name: capability.name,
        pluginId: plugin.id,
        isDefault: capability.isDefault,
      },
      create: {
        pluginId: plugin.id,
        key: capability.key,
        name: capability.name,
        isDefault: capability.isDefault,
      },
    })
  }

  await prisma.pluginDependency.upsert({
    where: {
      pluginId_dependsOnPluginId: {
        pluginId: pluginByKey['restaurant-kitchen'].id,
        dependsOnPluginId: pluginByKey['restaurant-tables'].id,
      },
    },
    update: {},
    create: {
      pluginId: pluginByKey['restaurant-kitchen'].id,
      dependsOnPluginId: pluginByKey['restaurant-tables'].id,
      minVersion: '1.0.0',
      required: true,
    },
  })

  for (const profile of ['SUPERMARKET', 'RESTAURANT', 'PHARMACY']) {
    const tenant = tenants[profile]
    const enabledSet = new Set(PROFILE_DEFAULTS[profile])
    for (const capability of CAPABILITIES) {
      await prisma.tenantFeatureFlag.upsert({
        where: {
          tenantId_capabilityKey: {
            tenantId: tenant.id,
            capabilityKey: capability.key,
          },
        },
        update: {
          enabled: enabledSet.has(capability.key),
          sourcePluginId: pluginByKey[capability.pluginKey].id,
          updatedBy: admin.id,
        },
        create: {
          tenantId: tenant.id,
          capabilityKey: capability.key,
          enabled: enabledSet.has(capability.key),
          sourcePluginId: pluginByKey[capability.pluginKey].id,
          updatedBy: admin.id,
        },
      })
    }
  }

  console.log('Seed complete:', {
    admin: admin.email,
    product: p1.sku,
    tenants: Object.keys(tenants),
    plugins: PLUGINS.length,
    capabilities: CAPABILITIES.length,
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
