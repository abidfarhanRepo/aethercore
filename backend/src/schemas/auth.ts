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

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
export type LogoutBody = z.infer<typeof logoutBodySchema>
