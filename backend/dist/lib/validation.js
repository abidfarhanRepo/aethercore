"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatZodErrors = formatZodErrors;
exports.parseWithSchema = parseWithSchema;
exports.registerGlobalValidationHook = registerGlobalValidationHook;
function formatZodErrors(error) {
    return error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : 'root',
        message: issue.message,
        code: issue.code,
    }));
}
function parseWithSchema(schema, payload) {
    return schema.parse(payload);
}
function registerGlobalValidationHook(server) {
    server.addHook('preValidation', async (request, reply) => {
        const routeConfig = (request.routeOptions?.config || {});
        const zodSchema = routeConfig.zod;
        if (!zodSchema) {
            return;
        }
        const details = {};
        if (zodSchema.body) {
            const bodyResult = zodSchema.body.safeParse(request.body);
            if (!bodyResult.success) {
                details.body = formatZodErrors(bodyResult.error);
            }
            else {
                request.body = bodyResult.data;
            }
        }
        if (zodSchema.params) {
            const paramsResult = zodSchema.params.safeParse(request.params);
            if (!paramsResult.success) {
                details.params = formatZodErrors(paramsResult.error);
            }
            else {
                request.params = paramsResult.data;
            }
        }
        if (zodSchema.query) {
            const queryResult = zodSchema.query.safeParse(request.query);
            if (!queryResult.success) {
                details.query = formatZodErrors(queryResult.error);
            }
            else {
                request.query = queryResult.data;
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
            });
        }
    });
}
