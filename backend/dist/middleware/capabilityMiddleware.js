"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCapability = requireCapability;
exports.requireAllCapabilities = requireAllCapabilities;
const client_1 = require("@prisma/client");
const securityCompliance_1 = require("../lib/securityCompliance");
const pluginService_1 = require("../lib/pluginService");
async function deny(req, reply, capability) {
    await (0, securityCompliance_1.logSecurityEventRecord)({
        eventType: client_1.SecurityEventType.CAPABILITY_DENIED,
        severity: client_1.SecuritySeverity.MEDIUM,
        source: 'middleware/capability',
        message: `Capability denied: ${capability}`,
        details: {
            type: 'authz.capability_denied',
            capability,
            path: req.url,
            method: req.method,
        },
        actorId: req.user?.id,
        ipAddress: req.ip,
    }).catch(() => { });
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
            return deny(req, reply, capability);
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
                return deny(req, reply, capability);
            }
        }
    };
}
