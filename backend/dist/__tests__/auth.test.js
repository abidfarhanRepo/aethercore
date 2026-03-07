"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const child_process_1 = require("child_process");
// We'll run the dev server as a child process for tests
let serverProcess;
beforeAll((done) => {
    serverProcess = (0, child_process_1.spawn)('node', ['dist/index.js'], { cwd: __dirname + '/../..', env: process.env, stdio: 'ignore' });
    // give server time to start
    setTimeout(done, 1000);
});
afterAll(() => {
    if (serverProcess)
        serverProcess.kill();
});
test('public GET /health', async () => {
    const res = await (0, supertest_1.default)('http://localhost:4000').get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
});
