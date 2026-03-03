"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const child_process_1 = require("child_process");
let serverProcess;
beforeAll((done) => {
    serverProcess = (0, child_process_1.spawn)('node', ['dist/index.js'], { cwd: __dirname + '/../..', env: process.env, stdio: 'ignore' });
    setTimeout(done, 1000);
});
afterAll(() => {
    if (serverProcess)
        serverProcess.kill();
});
const base = 'http://localhost:4000';
test('auth refresh token flow: register -> login -> refresh -> revoke', async () => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'password123';
    // register
    const r1 = await (0, supertest_1.default)(base).post('/auth/register').send({ email, password });
    expect(r1.status).toBe(200);
    expect(r1.body).toHaveProperty('id');
    // login
    const r2 = await (0, supertest_1.default)(base).post('/auth/login').send({ email, password });
    expect(r2.status).toBe(200);
    expect(r2.body).toHaveProperty('accessToken');
    expect(r2.body).toHaveProperty('refreshToken');
    const { accessToken, refreshToken } = r2.body;
    // use refresh to get new access token
    const r3 = await (0, supertest_1.default)(base).post('/auth/refresh').send({ refreshToken });
    expect(r3.status).toBe(200);
    expect(r3.body).toHaveProperty('accessToken');
    expect(r3.body).toHaveProperty('refreshToken');
    const newRefresh = r3.body.refreshToken;
    expect(newRefresh).not.toBe(refreshToken);
    // old refresh token should be revoked
    const r4 = await (0, supertest_1.default)(base).post('/auth/refresh').send({ refreshToken });
    expect(r4.status).toBe(401);
    // revoke current refresh token
    const r5 = await (0, supertest_1.default)(base).post('/auth/revoke').send({ refreshToken: newRefresh });
    expect(r5.status).toBe(200);
    expect(r5.body).toEqual({ ok: true });
    const r6 = await (0, supertest_1.default)(base).post('/auth/refresh').send({ refreshToken: newRefresh });
    expect(r6.status).toBe(401);
});
