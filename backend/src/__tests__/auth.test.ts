import request from 'supertest'
import { spawn } from 'child_process'

// We'll run the dev server as a child process for tests
let serverProcess: any

beforeAll((done) => {
  serverProcess = spawn('node', ['dist/index.js'], { cwd: __dirname + '/../..', env: process.env, stdio: 'ignore' })
  // give server time to start
  setTimeout(done, 1000)
})

afterAll(() => {
  if (serverProcess) serverProcess.kill()
})

test('public GET /health', async () => {
  const res = await request('http://localhost:4000').get('/health')
  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('status', 'ok')
})
