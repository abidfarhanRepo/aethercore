import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

export interface MfaEnrollPayload {
  secret: string
  otpAuthUrl: string
  qrCodeBase64: string
  recoveryCodes: string[]
}

export async function generateMfaEnrollment(email: string): Promise<MfaEnrollPayload> {
  const secret = speakeasy.generateSecret({
    name: `Aether POS (${email})`,
    issuer: 'Aether POS',
    length: 32,
  })

  const otpAuthUrl = secret.otpauth_url || ''
  const qrCodeBase64 = await QRCode.toDataURL(otpAuthUrl).then((dataUrl) => {
    return dataUrl.replace(/^data:image\/png;base64,/, '')
  })

  return {
    secret: secret.base32,
    otpAuthUrl,
    qrCodeBase64,
    recoveryCodes: generateRecoveryCodes(),
  }
}

export function verifyTotpToken(secret: string, token: string): boolean {
  const normalizedToken = token.trim()
  if (!/^\d{6}$/.test(normalizedToken)) {
    return false
  }

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: normalizedToken,
    window: 1,
  })
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase()
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase()
    return `${part1}-${part2}`
  })
}

export function consumeRecoveryCode(storedCodes: string[], providedCode: string): {
  isValid: boolean
  remainingCodes: string[]
} {
  const normalized = providedCode.trim().toUpperCase()
  const index = storedCodes.findIndex((code) => code.toUpperCase() === normalized)

  if (index === -1) {
    return { isValid: false, remainingCodes: storedCodes }
  }

  const remainingCodes = storedCodes.filter((_, codeIndex) => codeIndex !== index)
  return { isValid: true, remainingCodes }
}
