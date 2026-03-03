"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const purchases_1 = __importDefault(require("../routes/purchases"));
// lightweight smoke tests using sqlite in-memory would be ideal but here we do simple route registration smoke
describe('purchases routes', () => {
    let server;
    beforeAll(() => {
        server = (0, fastify_1.default)();
        server.register(purchases_1.default);
    });
    test('reject create without items', async () => {
        const res = await server.inject({ method: 'POST', url: '/purchases', payload: {} });
        expect(res.statusCode).toBe(400);
    });
    test('reject receive without items', async () => {
        const res = await server.inject({ method: 'POST', url: '/purchases/doesnotexist/receive', payload: {} });
        // should be 500 because id not found in our simple setup
        expect([400, 500, 404]).toContain(res.statusCode);
    });
});
