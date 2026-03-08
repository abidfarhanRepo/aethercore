import { z } from 'zod'

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
}).optional()

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
}).optional()

export const mfaVerifyBodySchema = z.object({
  token: z.string().regex(/^\d{6}$/),
})

export const mfaChallengeBodySchema = z.object({
  tempSessionToken: z.string().min(1),
  token: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().min(3).optional(),
}).refine((value) => Boolean(value.token || value.recoveryCode), {
  message: 'token or recoveryCode is required',
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
export type LogoutBody = z.infer<typeof logoutBodySchema>
export type MfaVerifyBody = z.infer<typeof mfaVerifyBodySchema>
export type MfaChallengeBody = z.infer<typeof mfaChallengeBodySchema>
