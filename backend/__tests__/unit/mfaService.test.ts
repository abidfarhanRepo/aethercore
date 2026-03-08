import speakeasy from 'speakeasy'
import {
  consumeRecoveryCode,
  generateMfaEnrollment,
  generateRecoveryCodes,
  verifyTotpToken,
} from '../../src/lib/mfaService'

describe('MFA Service', () => {
  it('generates enrollment payload with QR and recovery codes', async () => {
    const payload = await generateMfaEnrollment('admin@test.local')

    expect(payload.secret).toBeDefined()
    expect(payload.qrCodeBase64).toBeDefined()
    expect(payload.qrCodeBase64.length).toBeGreaterThan(20)
    expect(payload.recoveryCodes.length).toBe(8)
  })

  it('verifies valid TOTP tokens', () => {
    const secret = speakeasy.generateSecret({ length: 32 }).base32
    const token = speakeasy.totp({ secret, encoding: 'base32' })

    expect(verifyTotpToken(secret, token)).toBe(true)
    expect(verifyTotpToken(secret, '000000')).toBe(false)
  })

  it('consumes recovery code as single-use', () => {
    const codes = generateRecoveryCodes(3)
    const firstCode = codes[0]

    const firstAttempt = consumeRecoveryCode(codes, firstCode)
    expect(firstAttempt.isValid).toBe(true)
    expect(firstAttempt.remainingCodes).toHaveLength(2)

    const secondAttempt = consumeRecoveryCode(firstAttempt.remainingCodes, firstCode)
    expect(secondAttempt.isValid).toBe(false)
    expect(secondAttempt.remainingCodes).toHaveLength(2)
  })
})
