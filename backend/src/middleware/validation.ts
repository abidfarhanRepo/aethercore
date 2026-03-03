import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../errors/AppError'

/**
 * Validates request data against a Zod schema
 */
export async function validateRequest<T>(
  data: any,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    return await schema.parseAsync(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))
      throw new ValidationError('Request validation failed', details)
    }
    throw error
  }
}

/**
 * Creates a hook for validating request body
 */
export function createBodyValidator<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.body = await validateRequest(request.body, schema)
  }
}

/**
 * Creates a hook for validating request params
 */
export function createParamsValidator<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.params = await validateRequest(request.params, schema)
  }
}

/**
 * Creates a hook for validating request query
 */
export function createQueryValidator<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.query = await validateRequest(request.query, schema)
  }
}
