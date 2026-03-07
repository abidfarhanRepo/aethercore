"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCapability = requireCapability;
exports.requireAllCapabilities = requireAllCapabilities;
const pluginService_1 = require("../lib/pluginService");
async function deny(reply, capability) {
    return reply.code(403).send({
        error: 'Capability disabled',
        capability,
        code: 'CAPABILITY_DISABLED',
    });
}
function requireCapability(capability) {
    return async (req, reply) => {
        const user = req.user;
        const tenantId = await (0, pluginService_1.resolveTenantIdForUser)(user);
        const enabled = await (0, pluginService_1.isCapabilityEnabledForTenant)(tenantId, capability);
        if (!enabled) {
            return deny(reply, capability);
        }
    };
}
function requireAllCapabilities(capabilities) {
    return async (req, reply) => {
        const user = req.user;
        const tenantId = await (0, pluginService_1.resolveTenantIdForUser)(user);
        for (const capability of capabilities) {
            const enabled = await (0, pluginService_1.isCapabilityEnabledForTenant)(tenantId, capability);
            if (!enabled) {
                return deny(reply, capability);
            }
        }
    };
}
