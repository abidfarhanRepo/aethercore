/**
 * Custom error classes for the application
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details)
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTHENTICATION_ERROR', message)
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'AUTHORIZATION_ERROR', message)
    Object.setPrototypeOf(this, AuthorizationError.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID "${id}" not found` : `${resource} not found`
    super(404, 'NOT_FOUND', message)
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message)
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMIT_EXCEEDED', message)
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'An internal server error occurred') {
    super(500, 'INTERNAL_SERVER_ERROR', message)
    Object.setPrototypeOf(this, InternalServerError.prototype)
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service is temporarily unavailable') {
    super(503, 'SERVICE_UNAVAILABLE', message)
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(500, 'DATABASE_ERROR', message)
    Object.setPrototypeOf(this, DatabaseError.prototype)
  }
}
