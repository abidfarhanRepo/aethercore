"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const fastify_1 = __importDefault(require("fastify"));
const rateLimit_1 = __importDefault(require("../plugins/rateLimit"));
describe('rate limit plugin (memory)', () => {
    test('blocks when over limit', async () => {
        const app = (0, fastify_1.default)();
        await app.register(rateLimit_1.default);
        app.get('/test', async () => ({ ok: true }));
        await app.listen({ port: 0 });
        const address = app.server.address();
        // address may be object
        const port = address.port;
        const agent = (0, supertest_1.default)(`http://localhost:${port}`);
        for (let i = 0; i < 101; i++) {
            // make requests from same agent (same IP)
            const res = await agent.get('/test');
            if (i < 100)
                expect(res.status).toBe(200);
            else
                expect(res.status).toBe(429);
        }
        await app.close();
    }, 20000);
});
