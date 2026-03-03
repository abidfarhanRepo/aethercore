"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = roleRoutes;
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
async function roleRoutes(server) {
    // GET /roles - List all roles
    server.get('/api/roles', { preHandler: authMiddleware_1.requireAuth }, async (request, reply) => {
        try {
            const { limit = '50', offset = '0' } = request.query;
            const limitNum = Math.min(parseInt(limit), 100);
            const offsetNum = parseInt(offset);
            // Built-in roles
            const builtInRoles = [
                {
                    id: 'builtin-admin',
                    name: 'ADMIN',
                    description: 'Full system access',
                    isBuiltIn: true,
                    userCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'builtin-manager',
                    name: 'MANAGER',
                    description: 'Can manage users and view reports',
                    isBuiltIn: true,
                    userCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'builtin-supervisor',
                    name: 'SUPERVISOR',
                    description: 'Can view reports and user activity',
                    isBuiltIn: true,
                    userCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'builtin-cashier',
                    name: 'CASHIER',
                    description: 'Can perform checkout and sales',
                    isBuiltIn: true,
                    userCount: 0,
                    createdAt: new Date(),
                },
                {
                    id: 'builtin-stock-clerk',
                    name: 'STOCK_CLERK',
                    description: 'Can manage inventory',
                    isBuiltIn: true,
                    userCount: 0,
                    createdAt: new Date(),
                },
            ];
            // Count users by built-in role
            const roleCounts = await db_1.prisma.user.groupBy({
                by: ['role'],
                _count: true,
            });
            const roleLookup = Object.fromEntries(roleCounts.map((r) => [r.role, r._count]));
            const customRoles = await db_1.prisma.customRole.findMany({
                take: limitNum,
                skip: offsetNum,
                orderBy: { createdAt: 'desc' },
            });
            // Add user counts for custom roles
            const customRolesWithCounts = await Promise.all(customRoles.map(async (role) => {
                const count = await db_1.prisma.userRole.count({
                    where: { customRoleId: role.id },
                });
                return {
                    ...role,
                    isBuiltIn: false,
                    userCount: count,
                };
            }));
            // Update built-in roles with counts
            builtInRoles.forEach((role) => {
                role.userCount = roleLookup[role.name.split('-')[1]] || roleLookup[role.name] || 0;
            });
            const allRoles = [...builtInRoles, ...customRolesWithCounts];
            const total = builtInRoles.length + (await db_1.prisma.customRole.count());
            reply.send({
                roles: allRoles,
                total,
                limit: limitNum,
                offset: offsetNum,
            });
        }
        catch (err) {
            reply.code(500).send({ error: 'Failed to list roles' });
        }
    });
    // GET /roles/:id - Get role details
    server.get('/api/roles/:id', { preHandler: authMiddleware_1.requireAuth }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Check if it's a built-in role
            if (id.startsWith('builtin-')) {
                const roleType = id.replace('builtin-', '').toUpperCase().replace('-', '_');
                const builtInRoles = {
                    ADMIN: {
                        id: 'builtin-admin',
                        name: 'ADMIN',
                        description: 'Full system access',
                        permissions: [
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
                        isBuiltIn: true,
                    },
                    MANAGER: {
                        id: 'builtin-manager',
                        name: 'MANAGER',
                        description: 'Can manage users and view reports',
                        permissions: [
                            'products.read',
                            'sales.read',
                            'sales.refund',
                            'sales.return',
                            'inventory.read',
                            'purchases.read',
                            'reports.view',
                            'reports.export',
                            'users.read',
                            'users.update',
                            'users.change-password',
                            'users.reset-password',
                            'roles.read',
                            'audit.view',
                        ],
                        isBuiltIn: true,
                    },
                    SUPERVISOR: {
                        id: 'builtin-supervisor',
                        name: 'SUPERVISOR',
                        description: 'Can view reports and user activity',
                        permissions: [
                            'products.read',
                            'sales.read',
                            'inventory.read',
                            'purchases.read',
                            'reports.view',
                            'users.read',
                            'users.change-password',
                            'audit.view',
                        ],
                        isBuiltIn: true,
                    },
                    CASHIER: {
                        id: 'builtin-cashier',
                        name: 'CASHIER',
                        description: 'Can perform checkout and sales',
                        permissions: [
                            'products.read',
                            'sales.create',
                            'sales.read',
                            'sales.void',
                            'sales.refund',
                            'sales.return',
                            'inventory.read',
                            'users.change-password',
                        ],
                        isBuiltIn: true,
                    },
                    STOCK_CLERK: {
                        id: 'builtin-stock-clerk',
                        name: 'STOCK_CLERK',
                        description: 'Can manage inventory',
                        permissions: [
                            'products.read',
                            'inventory.read',
                            'inventory.update',
                            'inventory.adjust',
                            'inventory.transfer',
                            'inventory.recount',
                            'purchases.read',
                            'users.change-password',
                        ],
                        isBuiltIn: true,
                    },
                };
                const role = builtInRoles[roleType];
                if (!role)
                    return reply.code(404).send({ error: 'role not found' });
                const userCount = await db_1.prisma.user.count({
                    where: { role: roleType },
                });
                return reply.send({ ...role, userCount });
            }
            // Custom role
            const role = await db_1.prisma.customRole.findUnique({
                where: { id },
            });
            if (!role)
                return reply.code(404).send({ error: 'role not found' });
            const userCount = await db_1.prisma.userRole.count({
                where: { customRoleId: id },
            });
            reply.send({ ...role, userCount, isBuiltIn: false });
        }
        catch (err) {
            reply.code(500).send({ error: 'Failed to get role' });
        }
    });
    // POST /roles - Create custom role (ADMIN only)
    server.post('/api/roles', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (request, reply) => {
        try {
            const { name, description, permissions } = request.body;
            if (!name || !Array.isArray(permissions)) {
                return reply.code(400).send({ error: 'name and permissions array required' });
            }
            // Check if role already exists
            const existing = await db_1.prisma.customRole.findUnique({ where: { name } });
            if (existing) {
                return reply.code(409).send({ error: 'role already exists' });
            }
            const role = await db_1.prisma.customRole.create({
                data: {
                    name,
                    description,
                    permissions,
                },
            });
            // Log creation
            await db_1.prisma.auditLog.create({
                data: {
                    actorId: request.user.id,
                    action: 'ROLE_CREATED',
                    resource: 'ROLE',
                    resourceId: role.id,
                    details: `Created custom role ${name}`,
                },
            });
            reply.code(201).send({ ...role, userCount: 0, isBuiltIn: false });
        }
        catch (err) {
            reply.code(500).send({ error: 'Failed to create role' });
        }
    });
    // PUT /roles/:id - Update role permissions (ADMIN only)
    server.put('/api/roles/:id', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (request, reply) => {
        try {
            const { id } = request.params;
            const { description, permissions } = request.body;
            // Cannot update built-in roles
            if (id.startsWith('builtin-')) {
                return reply.code(400).send({ error: 'cannot update built-in roles' });
            }
            const role = await db_1.prisma.customRole.findUnique({ where: { id } });
            if (!role)
                return reply.code(404).send({ error: 'role not found' });
            const updated = await db_1.prisma.customRole.update({
                where: { id },
                data: {
                    description,
                    permissions: permissions || role.permissions,
                },
            });
            // Log update
            await db_1.prisma.auditLog.create({
                data: {
                    actorId: request.user.id,
                    action: 'ROLE_UPDATED',
                    resource: 'ROLE',
                    resourceId: id,
                    details: `Updated custom role ${role.name}`,
                },
            });
            const userCount = await db_1.prisma.userRole.count({
                where: { customRoleId: id },
            });
            reply.send({ ...updated, userCount, isBuiltIn: false });
        }
        catch (err) {
            reply.code(500).send({ error: 'Failed to update role' });
        }
    });
    // DELETE /roles/:id - Delete custom role (ADMIN only)
    server.delete('/api/roles/:id', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Cannot delete built-in roles
            if (id.startsWith('builtin-')) {
                return reply.code(400).send({ error: 'cannot delete built-in roles' });
            }
            const role = await db_1.prisma.customRole.findUnique({ where: { id } });
            if (!role)
                return reply.code(404).send({ error: 'role not found' });
            // Check if any users have this role
            const userCount = await db_1.prisma.userRole.count({
                where: { customRoleId: id },
            });
            if (userCount > 0) {
                return reply.code(400).send({ error: 'cannot delete role with assigned users' });
            }
            await db_1.prisma.customRole.delete({ where: { id } });
            // Log deletion
            await db_1.prisma.auditLog.create({
                data: {
                    actorId: request.user.id,
                    action: 'ROLE_DELETED',
                    resource: 'ROLE',
                    resourceId: id,
                    details: `Deleted custom role ${role.name}`,
                },
            });
            reply.send({ message: 'role deleted successfully' });
        }
        catch (err) {
            reply.code(500).send({ error: 'Failed to delete role' });
        }
    });
}
