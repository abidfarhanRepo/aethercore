"use strict";
/**
 * Custom error classes for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.ServiceUnavailableError = exports.InternalServerError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(400, 'VALIDATION_ERROR', message, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(401, 'AUTHENTICATION_ERROR', message);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(403, 'AUTHORIZATION_ERROR', message);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource, id) {
        const message = id ? `${resource} with ID "${id}" not found` : `${resource} not found`;
        super(404, 'NOT_FOUND', message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(409, 'CONFLICT', message);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests. Please try again later.') {
        super(429, 'RATE_LIMIT_EXCEEDED', message);
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
class InternalServerError extends AppError {
    constructor(message = 'An internal server error occurred') {
        super(500, 'INTERNAL_SERVER_ERROR', message);
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
exports.InternalServerError = InternalServerError;
class ServiceUnavailableError extends AppError {
    constructor(message = 'Service is temporarily unavailable') {
        super(503, 'SERVICE_UNAVAILABLE', message);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(500, 'DATABASE_ERROR', message);
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
exports.DatabaseError = DatabaseError;
