import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'

export default async function auditRoutes(fastify: FastifyInstance){
  fastify.get('/api/v1/audits', async () => {
    const audits = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return audits
  })

  // internal helper to create audit entries (not exposed as public endpoint)
  fastify.decorate('createAudit', async (action: string, details: any, actorId?: string) => {
    return prisma.auditLog.create({ data: { action, details: JSON.stringify(details), actorId: actorId || 'system' } })
  })
}
