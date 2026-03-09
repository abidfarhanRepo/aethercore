/// <reference types="jest" />

import {
  clearQueuedSecurityEventsForTests,
  getQueuedSecurityEventCount,
  logSecurityEvent,
} from './security'

async function settleAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('security event transport', () => {
  beforeEach(() => {
    clearQueuedSecurityEventsForTests()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('accessToken', 'test-token')
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('queues event when request fails and flushes on next successful request', async () => {
    const fetchMock = globalThis.fetch as jest.Mock

    fetchMock.mockRejectedValueOnce(new Error('offline'))
    logSecurityEvent('auth.login_failed', { email: 'user@example.com' }, 'high')
    await settleAsyncWork()

    expect(getQueuedSecurityEventCount()).toBe(1)

    fetchMock.mockResolvedValue({ ok: true, status: 201 })
    fetchMock.mockResolvedValue({ ok: true, status: 201 })

    logSecurityEvent('session.idle_lock', { timeoutMinutes: 10 }, 'medium')
    await settleAsyncWork()

    expect(getQueuedSecurityEventCount()).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const callBodies = fetchMock.mock.calls.map((call: any[]) => JSON.parse((call[1] as { body: string }).body))
    expect(callBodies.some((payload: { type: string }) => payload.type === 'auth.login_failed')).toBe(true)
    expect(callBodies.some((payload: { type: string }) => payload.type === 'session.idle_lock')).toBe(true)
  })

  test('queues event on server error response', async () => {
    const fetchMock = globalThis.fetch as jest.Mock

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 })
    logSecurityEvent('auth.mfa_failed', { mode: 'totp' }, 'high')
    await settleAsyncWork()

    expect(getQueuedSecurityEventCount()).toBe(1)
  })
})
