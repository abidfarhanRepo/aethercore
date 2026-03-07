"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.PERMISSION_MATRIX = void 0;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../utils/db");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return db_1.prisma; } });
const logger_1 = require("../utils/logger");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me';
// Permission Matrix
exports.PERMISSION_MATRIX = {
    ADMIN: [
        // All permissions
        'products.create',
        'products.read',
        'products.update',
        'products.delete',
        'sales.create',
        'sales.read',
        'sales.update',
        'sales.void',
        'sales.refund',
        'sales.return',
        'inventory.read',
        'inventory.update',
        'inventory.adjust',
        'inventory.transfer',
        'inventory.recount',
        'purchases.create',
        'purchases.read',
        'purchases.update',
        'purchases.receive',
        'purchases.cancel',
        'reports.view',
        'reports.export',
        'users.create',
        'users.read',
        'users.update',
        'users.delete',
        'users.change-password',
        'users.reset-password',
        'users.unlock',
        'roles.create',
        'roles.read',
        'roles.update',
        'roles.delete',
        'audit.view',
    ],
    MANAGER: [
        'products.read',
        'sales.read',
        'sales.refund',
        'sales.return',
        'inventory.read',
        'purchases.read',
        'reports.view',
        'reports.export',
        'users.read',
        'users.update', // Can update non-admin users
        'users.change-password',
        'users.reset-password',
        'roles.read',
        'audit.view',
    ],
    SUPERVISOR: [
        'products.read',
        'sales.read',
        'inventory.read',
        'purchases.read',
        'reports.view',
        'users.read',
        'users.change-password',
        'audit.view',
    ],
    CASHIER: [
        'products.read',
        'sales.create',
        'sales.read',
        'sales.void',
        'sales.refund',
        'sales.return',
        'inventory.read',
        'users.change-password',
    ],
    STOCK_CLERK: [
        'products.read',
        'inventory.read',
        'inventory.update',
        'inventory.adjust',
        'inventory.transfer',
        'inventory.recount',
        'purchases.read',
        'users.change-password',
    ],
};
async function requireAuth(req, reply) {
    const auth = req.headers.authorization;
    if (!auth)
        return reply.code(401).send({ error: 'missing auth' });
    const token = auth.replace(/^Bearer\s+/, '');
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_ACCESS_SECRET);
        // Fetch full user data
        const user = await db_1.prisma.user.findUnique({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                role: true,
                tenantId: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            return reply.code(401).send({ error: 'user not found or inactive' });
        }
        // attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            firstName: user.firstName,
            lastName: user.lastName,
            isActive: user.isActive,
        };
    }
    catch (e) {
        return reply.code(401).send({ error: 'invalid token' });
    }
}
function requireRole(...allowedRoles) {
    return async (req, reply) => {
        const user = req.user;
        if (!user)
            return reply.code(401).send({ error: 'unauthenticated' });
        if (!allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
            // Log permission denial
            await logPermissionDenial(user.id, 'DENY', 'UNKNOWN', `role:${allowedRoles.join(',')}`, req);
            return reply.code(403).send({ error: 'forbidden' });
        }
    };
}
function requirePermission(...permissions) {
    return async (req, reply) => {
        const user = req.user;
        if (!user)
            return reply.code(401).send({ error: 'unauthenticated' });
        // Check if user has permission
        const hasPermission = await checkPermission(user.id, user.role, permissions);
        if (!hasPermission) {
            // Log permission denial
            await logPermissionDenial(user.id, 'DENY', permissions.join(','), 'denied', req);
            return reply.code(403).send({ error: 'forbidden' });
        }
        // Log successful permission check
        await logPermissionDenial(user.id, 'ATTEMPT', permissions.join(','), 'granted', req);
    };
}
async function checkPermission(userId, role, requiredPermissions) {
    // ADMIN always has permission
    if (role === 'ADMIN')
        return true;
    const matrixPermissions = exports.PERMISSION_MATRIX[role] || [];
    // Check if user has all required permissions
    return requiredPermissions.every((perm) => matrixPermissions.includes(perm));
}
async function logPermissionDenial(userId, action, permission, granted, req) {
    try {
        await db_1.prisma.permissionLog.create({
            data: {
                userId,
                action,
                resource: permission.split('.')[0] || 'UNKNOWN',
                permission,
                granted: typeof granted === 'boolean' ? granted : granted === 'granted',
                ipAddress: req.ip || req.socket?.remoteAddress,
            },
        });
    }
    catch (e) {
        // Silently fail audit logging
        logger_1.logger.error({ error: e }, 'Failed to log permission');
    }
}
