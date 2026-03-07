import { checkIdempotency, clearIdempotency, saveIdempotency } from '../../src/utils/idempotency'
import { closeRedisClient } from '../../src/lib/redis'

describe('Idempotency utility', () => {
  afterAll(async () => {
    await closeRedisClient()
  })

  it('returns cached result for duplicate key', async () => {
    const key = `idempotency-test-${Date.now()}`
    const payload = { ok: true, value: 42 }

    await clearIdempotency(key)
    const before = await checkIdempotency(key)
    expect(before.exists).toBe(false)

    await saveIdempotency(key, payload, 60)

    const after = await checkIdempotency(key)
    expect(after.exists).toBe(true)
    expect(after.result).toEqual(payload)

    await clearIdempotency(key)
  })

  it('returns same response and executes handler once for duplicate key', async () => {
    const key = `idempotency-dup-${Date.now()}`
    let handlerExecutions = 0

    const processOnceWithIdempotency = async () => {
      const cached = await checkIdempotency(key)
      if (cached.exists) {
        return cached.result
      }

      handlerExecutions += 1
      const responsePayload = {
        success: true,
        paymentId: `pay-${Date.now()}`,
        transactionId: `txn-${Date.now()}`,
        status: 'CAPTURED',
      }

      await saveIdempotency(key, responsePayload, 60)
      return responsePayload
    }

    await clearIdempotency(key)

    const first = await processOnceWithIdempotency()
    const second = await processOnceWithIdempotency()

    expect(first).toEqual(second)
    expect(handlerExecutions).toBe(1)

    await clearIdempotency(key)
  })
})
