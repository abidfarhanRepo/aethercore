"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILE_CAPABILITY_DEFAULTS = void 0;
exports.resolveTenantIdForUser = resolveTenantIdForUser;
exports.isCapabilityEnabledForTenant = isCapabilityEnabledForTenant;
exports.ensureTenantCapabilityFlag = ensureTenantCapabilityFlag;
const db_1 = require("../utils/db");
exports.PROFILE_CAPABILITY_DEFAULTS = {
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
};
const LEGACY_SETTING_MAP = {
    'restaurant.table_service': 'feature_restaurant_enabled',
    'restaurant.kds': 'feature_kitchen_enabled',
    'pharmacy.prescription_validation': 'feature_pharmacy_enabled',
    'pharmacy.controlled_substances': 'feature_pharmacy_enabled',
    'pharmacy.drug_interactions': 'feature_pharmacy_enabled',
    'inventory.expiry': 'feature_expiry_lots_enabled',
    'inventory.lot_tracking': 'feature_expiry_lots_enabled',
    'procurement.receiving': 'feature_receiving_enabled',
};
async function resolveTenantIdForUser(user) {
    if (user?.tenantId) {
        return user.tenantId;
    }
    const defaultTenant = await db_1.prisma.tenant.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    return defaultTenant?.id || null;
}
async function isCapabilityEnabledForTenant(tenantId, capabilityKey) {
    if (!tenantId) {
        return false;
    }
    const flag = await db_1.prisma.tenantFeatureFlag.findUnique({
        where: {
            tenantId_capabilityKey: {
                tenantId,
                capabilityKey,
            },
        },
        select: { enabled: true },
    });
    if (flag) {
        return flag.enabled;
    }
    const settingKey = LEGACY_SETTING_MAP[capabilityKey];
    if (settingKey) {
        const setting = await db_1.prisma.settings.findUnique({ where: { key: settingKey }, select: { value: true } });
        if (setting) {
            return setting.value === 'true';
        }
    }
    const tenant = await db_1.prisma.tenant.findUnique({ where: { id: tenantId }, select: { profile: true } });
    if (!tenant) {
        return false;
    }
    return exports.PROFILE_CAPABILITY_DEFAULTS[tenant.profile].includes(capabilityKey);
}
async function ensureTenantCapabilityFlag(args) {
    const config = args.config;
    const capability = await db_1.prisma.pluginCapability.findUnique({
        where: { key: args.capabilityKey },
        select: { id: true },
    });
    return db_1.prisma.tenantFeatureFlag.upsert({
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
    });
}
