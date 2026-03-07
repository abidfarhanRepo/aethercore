import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      role: string
      tenantId?: string | null
      firstName?: string | null
      lastName?: string | null
      isActive?: boolean
    }
    security?: {
      ip: string
      userAgent: string
      origin: string
    }
    jwtVerify: () => Promise<unknown>
  }
}

export {}