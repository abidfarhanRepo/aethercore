"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = notificationRoutes;
const authMiddleware_1 = require("../plugins/authMiddleware");
const notificationService_1 = require("../lib/notificationService");
async function notificationRoutes(fastify) {
    fastify.get('/api/notifications', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        const query = (req.query || {});
        const includeArchived = query.includeArchived === 'true';
        const unreadOnly = query.unreadOnly === 'true';
        const limit = query.limit ? Number(query.limit) : undefined;
        if (!user?.id) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        const notifications = await (0, notificationService_1.listNotifications)({
            recipientId: user.id,
            includeArchived,
            unreadOnly,
            limit,
        });
        return { notifications };
    });
    fastify.get('/api/notifications/unread-count', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        if (!user?.id) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        const count = await (0, notificationService_1.getUnreadCount)(user.id);
        return { unreadCount: count };
    });
    fastify.patch('/api/notifications/:id/read', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        const { id } = req.params;
        if (!user?.id) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        const updated = await (0, notificationService_1.markNotificationRead)(id, user.id);
        if (updated.count === 0) {
            return reply.code(404).send({ error: 'Notification not found' });
        }
        return { ok: true };
    });
    fastify.patch('/api/notifications/:id/archive', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        const { id } = req.params;
        if (!user?.id) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        const updated = await (0, notificationService_1.archiveNotification)(id, user.id);
        if (updated.count === 0) {
            return reply.code(404).send({ error: 'Notification not found' });
        }
        return { ok: true };
    });
}
