import { z } from 'zod'

export const openCashSessionBodySchema = z.object({
  terminalId: z.string().trim().min(1).max(100).optional(),
  openingFloatCents: z.number().int().min(0),
})

export type OpenCashSessionBody = z.infer<typeof openCashSessionBodySchema>

export const closeCashSessionBodySchema = z.object({
  declaredCashCents: z.number().int().min(0),
})

export type CloseCashSessionBody = z.infer<typeof closeCashSessionBodySchema>

export const cashSessionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
})

export type CashSessionIdParams = z.infer<typeof cashSessionIdParamsSchema>

export const listCashSessionsQuerySchema = z.object({
  terminalId: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type ListCashSessionsQuery = z.infer<typeof listCashSessionsQuerySchema>
