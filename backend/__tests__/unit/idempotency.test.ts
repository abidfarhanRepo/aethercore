import { checkIdempotency, clearIdempotency, saveIdempotency } from '../../src/utils/idempotency'

describe('Idempotency utility', () => {
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
})
