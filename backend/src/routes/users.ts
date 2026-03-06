import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
const bcrypt = require('bcryptjs')
import crypto from 'crypto'
import { prisma } from '../utils/db'
import { requireAuth, requireRole, requirePermission } from '../plugins/authMiddleware'

export default async function userRoutes(server: FastifyInstance) {
  // Backward-compatible admin endpoint used by legacy Admin component.
  server.get(
    '/api/admin/users',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        })

        reply.send(users)
      } catch {
        reply.code(500).send({ error: 'Failed to list users' })
      }
    }
  )

  // GET /users - List all users
  server.get<{ Querystring: { role?: string; department?: string; search?: string; limit?: string; offset?: string } }>(
    '/api/users',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any
        const { role, department, search, limit = '50', offset = '0' } = query
        const limitNum = Math.min(parseInt(limit as string), 100)
        const offsetNum = parseInt(offset as string)

        const where: any = {}
        if (role) where.role = role
        if (department) where.department = department
        if (search) {
          where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ]
        }

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
              department: true,
              manager: { select: { id: true, firstName: true, lastName: true } },
              isActive: true,
              lastLogin: true,
              createdAt: true,
            },
            take: limitNum,
            skip: offsetNum,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.user.count({ where }),
        ])

        reply.send({ users, total, limit: limitNum, offset: offsetNum })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to list users' })
      }
    }
  )

  // GET /users/:id - Get user details
  server.get<{ Params: { id: string } }>(
    '/api/users/:id',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as any
        const { id } = params
        const user = (request as any).user

        // Users can view themselves, ADMIN/MANAGER can view others
        if (user.id !== id && !['ADMIN', 'MANAGER'].includes(user.role)) {
          return reply.code(403).send({ error: 'forbidden' })
        }

        const userData = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            department: true,
            manager: { select: { id: true, firstName: true, lastName: true } },
            isActive: true,
            lastLogin: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        if (!userData) return reply.code(404).send({ error: 'user not found' })
        reply.send(userData)
      } catch (err) {
        reply.code(500).send({ error: 'Failed to get user' })
      }
    }
  )

  // POST /users - Create new user (ADMIN only)
  server.post<{ Body: any }>(
    '/api/users',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any
        const { email, password, firstName, lastName, phone, role, department, managerId } = body

        if (!email || !password) {
          return reply.code(400).send({ error: 'email and password required' })
        }

        // Validate password strength
        if (password.length < 8) {
          return reply.code(400).send({ error: 'password must be at least 8 characters' })
        }

        // Check if user exists
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          return reply.code(409).send({ error: 'user already exists' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: role || 'CASHIER',
            department,
            managerId,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        })

        // Log user creation
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'USER_CREATED',
            resource: 'USER',
            resourceId: user.id,
            details: `Created user ${email} with role ${role}`,
          },
        })

        reply.code(201).send(user)
      } catch (err) {
        reply.code(500).send({ error: 'Failed to create user' })
      }
    }
  )

  // PUT /users/:id - Update user (ADMIN only)
  server.put<{ Params: { id: string }; Body: any }>(
    '/api/users/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const { firstName, lastName, phone, role, department, managerId, isActive } = request.body

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        const updated = await prisma.user.update({
          where: { id },
          data: {
            firstName,
            lastName,
            phone,
            role,
            department,
            managerId,
            isActive,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        })

        // Log update
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'USER_UPDATED',
            resource: 'USER',
            resourceId: id,
            details: `Updated user ${user.email}`,
          },
        })

        reply.send(updated)
      } catch (err) {
        reply.code(500).send({ error: 'Failed to update user' })
      }
    }
  )

  // DELETE /users/:id - Deactivate user (ADMIN only)
  server.delete<{ Params: { id: string } }>(
    '/api/users/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        // Prevent deactivating self
        if (user.id === (request as any).user.id) {
          return reply.code(400).send({ error: 'cannot deactivate yourself' })
        }

        const updated = await prisma.user.update({
          where: { id },
          data: { isActive: false },
          select: { id: true, email: true, isActive: true },
        })

        // Log deletion
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'USER_DEACTIVATED',
            resource: 'USER',
            resourceId: id,
            details: `Deactivated user ${user.email}`,
          },
        })

        reply.send(updated)
      } catch (err) {
        reply.code(500).send({ error: 'Failed to deactivate user' })
      }
    }
  )

  // POST /users/:id/change-password - Change own password
  server.post<{ Params: { id: string }; Body: any }>(
    '/api/users/:id/change-password',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const { currentPassword, newPassword } = request.body
        const authUser = (request as any).user

        // Users can only change their own password
        if (authUser.id !== id && authUser.role !== 'ADMIN') {
          return reply.code(403).send({ error: 'forbidden' })
        }

        if (!currentPassword || !newPassword) {
          return reply.code(400).send({ error: 'currentPassword and newPassword required' })
        }

        if (newPassword.length < 8) {
          return reply.code(400).send({ error: 'password must be at least 8 characters' })
        }

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        // Verify current password (unless admin changing someone else's password)
        if (authUser.id === id) {
          const passwordValid = await bcrypt.compare(currentPassword, user.password)
          if (!passwordValid) {
            return reply.code(401).send({ error: 'current password is incorrect' })
          }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)
        await prisma.user.update({
          where: { id },
          data: {
            password: hashedPassword,
            failedLoginAttempts: 0,
            lockedAt: null,
          },
        })

        // Log password change
        await prisma.auditLog.create({
          data: {
            actorId: authUser.id,
            action: 'PASSWORD_CHANGED',
            resource: 'USER',
            resourceId: id,
            details: `Password changed for user ${user.email}`,
          },
        })

        reply.send({ message: 'password changed successfully' })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to change password' })
      }
    }
  )

  // POST /users/:id/reset-password - Admin reset (ADMIN only)
  server.post<{ Params: { id: string } }>(
    '/api/users/:id/reset-password',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex')
        const hashedToken = await bcrypt.hash(resetToken, 10)
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        await prisma.user.update({
          where: { id },
          data: {
            passwordResetToken: hashedToken,
            passwordResetExpiry: expiryTime,
            failedLoginAttempts: 0,
            lockedAt: null,
          },
        })

        // Log reset
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'PASSWORD_RESET',
            resource: 'USER',
            resourceId: id,
            details: `Password reset initiated for user ${user.email}`,
          },
        })

        reply.send({ resetToken, expiresIn: '24h', message: 'Password reset token generated' })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to reset password' })
      }
    }
  )

  // POST /users/:id/unlock - Unlock locked account (ADMIN only)
  server.post<{ Params: { id: string } }>(
    '/api/users/:id/unlock',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        await prisma.user.update({
          where: { id },
          data: {
            lockedAt: null,
            failedLoginAttempts: 0,
          },
        })

        // Log unlock
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'ACCOUNT_UNLOCKED',
            resource: 'USER',
            resourceId: id,
            details: `Account unlocked for user ${user.email}`,
          },
        })

        reply.send({ message: 'account unlocked' })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to unlock account' })
      }
    }
  )

  // PUT /users/:id/roles - Update user roles (ADMIN only)
  server.put<{ Params: { id: string }; Body: any }>(
    '/api/users/:id/roles',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const { customRoleIds } = request.body

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        // Clear existing custom roles
        await prisma.userRole.deleteMany({ where: { userId: id } })

        // Add new roles
        if (customRoleIds && Array.isArray(customRoleIds)) {
          await prisma.userRole.createMany({
            data: customRoleIds.map((roleId: string) => ({
              userId: id,
              customRoleId: roleId,
            })),
          })
        }

        // Log update
        await prisma.auditLog.create({
          data: {
            actorId: (request as any).user.id,
            action: 'USER_ROLES_UPDATED',
            resource: 'USER',
            resourceId: id,
            details: `Updated roles for user ${user.email}`,
          },
        })

        reply.send({ message: 'roles updated successfully' })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to update roles' })
      }
    }
  )

  // GET /users/:id/audit-log - View user activity log
  server.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/users/:id/audit-log',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params
        const { limit = '50', offset = '0' } = request.query
        const limitNum = Math.min(parseInt(limit), 100)
        const offsetNum = parseInt(offset)

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return reply.code(404).send({ error: 'user not found' })

        const [logs, total] = await Promise.all([
          prisma.auditLog.findMany({
            where: { actorId: id },
            select: {
              id: true,
              action: true,
              resource: true,
              resourceId: true,
              details: true,
              createdAt: true,
            },
            take: limitNum,
            skip: offsetNum,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.auditLog.count({ where: { actorId: id } }),
        ])

        reply.send({ logs, total, limit: limitNum, offset: offsetNum })
      } catch (err) {
        reply.code(500).send({ error: 'Failed to get audit log' })
      }
    }
  )
}
