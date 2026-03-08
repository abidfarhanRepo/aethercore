import { FastifyInstance } from 'fastify'
import { ZodError, ZodTypeAny } from 'zod'

export type ZodRequestSchema = {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

export type FormattedZodErrors = Array<{
  path: string
  message: string
  code: string
}>

export function formatZodErrors(error: ZodError): FormattedZodErrors {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
    code: issue.code,
  }))
}

export function parseWithSchema<T>(schema: ZodTypeAny, payload: unknown): T {
  return schema.parse(payload) as T
}

type RouteConfigWithZod = {
  zod?: ZodRequestSchema
}

export function registerGlobalValidationHook(server: FastifyInstance): void {
  server.addHook('preValidation', async (request, reply) => {
    const routeConfig = (request.routeOptions?.config || {}) as RouteConfigWithZod
    const zodSchema = routeConfig.zod

    if (!zodSchema) {
      return
    }

    const details: Record<string, unknown> = {}

    if (zodSchema.body) {
      const bodyResult = zodSchema.body.safeParse(request.body)
      if (!bodyResult.success) {
        details.body = formatZodErrors(bodyResult.error)
      } else {
        request.body = bodyResult.data
      }
    }

    if (zodSchema.params) {
      const paramsResult = zodSchema.params.safeParse(request.params)
      if (!paramsResult.success) {
        details.params = formatZodErrors(paramsResult.error)
      } else {
        request.params = paramsResult.data
      }
    }

    if (zodSchema.query) {
      const queryResult = zodSchema.query.safeParse(request.query)
      if (!queryResult.success) {
        details.query = formatZodErrors(queryResult.error)
      } else {
        request.query = queryResult.data
      }
    }

    if (Object.keys(details).length > 0) {
      return reply.status(400).send({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        statusCode: 400,
        details,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      })
    }
  })
}
