"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupErrorHandler = setupErrorHandler;
const AppError_1 = require("../errors/AppError");
/**
 * Global error handler for Fastify
 */
function setupErrorHandler(server) {
    server.setErrorHandler(async (error, request, reply) => {
        const requestId = request.id || 'unknown';
        const timestamp = new Date().toISOString();
        let appError;
        if (error instanceof AppError_1.AppError) {
            appError = error;
        }
        else if (error.message && error.message.includes('UNIQUE constraint')) {
            appError = new AppError_1.AppError(409, 'DUPLICATE_ENTRY', 'A record with this value already exists', { field: error.meta?.target?.[0] });
        }
        else if (error.message && error.message.includes('FOREIGN KEY constraint')) {
            appError = new AppError_1.AppError(400, 'INVALID_REFERENCE', 'Referenced resource does not exist', {});
        }
        else if (error.statusCode === 400) {
            // Validation error from Fastify
            appError = new AppError_1.AppError(400, 'VALIDATION_ERROR', error.message || 'Invalid request', { validation: error.validation });
        }
        else {
            // Unknown error - log it but don't expose details to client
            server.log.error({
                error: error.message,
                stack: error.stack,
                requestId,
                path: request.url,
                method: request.method,
            });
            appError = new AppError_1.InternalServerError(process.env.NODE_ENV === 'development'
                ? error.message
                : 'An unexpected error occurred');
        }
        const response = {
            success: false,
            code: appError.code,
            message: appError.message,
            statusCode: appError.statusCode,
            requestId,
            timestamp,
        };
        if (appError.details) {
            response.details = appError.details;
        }
        // Log all errors
        server.log.error({
            code: appError.code,
            message: appError.message,
            statusCode: appError.statusCode,
            requestId,
            path: request.url,
            method: request.method,
        });
        return reply.status(appError.statusCode).send(response);
    });
}
