import 'fastify'

declare module 'fastify' {
  interface FastifyContextConfig {
    zod?: {
      body?: unknown
      params?: unknown
      query?: unknown
    }
  }

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