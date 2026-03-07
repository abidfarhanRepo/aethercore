"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
exports.createBodyValidator = createBodyValidator;
exports.createParamsValidator = createParamsValidator;
exports.createQueryValidator = createQueryValidator;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
/**
 * Validates request data against a Zod schema
 */
async function validateRequest(data, schema) {
    try {
        return await schema.parseAsync(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const details = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            throw new AppError_1.ValidationError('Request validation failed', details);
        }
        throw error;
    }
}
/**
 * Creates a hook for validating request body
 */
function createBodyValidator(schema) {
    return async (request, _reply) => {
        request.body = await validateRequest(request.body, schema);
    };
}
/**
 * Creates a hook for validating request params
 */
function createParamsValidator(schema) {
    return async (request, _reply) => {
        request.params = await validateRequest(request.params, schema);
    };
}
/**
 * Creates a hook for validating request query
 */
function createQueryValidator(schema) {
    return async (request, _reply) => {
        request.query = await validateRequest(request.query, schema);
    };
}
