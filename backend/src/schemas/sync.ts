import { z } from 'zod'
import { idSchema } from './common'

export const syncOperationSchema = z.object({
  id: z.string().trim().optional(),
  offlineOpId: z.string().trim().optional(),
  terminalId: z.string().trim().optional(),
  endpoint: z.string().trim().min(1),
  operationType: z.enum(['POST', 'PUT', 'DELETE']).optional(),
  type: z.enum(['POST', 'PUT', 'DELETE']).optional(),
  clientCreatedAt: z.string().datetime().optional(),
  data: z.record(z.unknown()).optional(),
})

export const syncBatchBodySchema = z.object({
  operations: z.array(syncOperationSchema),
})

export const replayDeadLetterParamsSchema = z.object({
  id: idSchema,
})

export type SyncBatchBody = z.infer<typeof syncBatchBodySchema>
export type ReplayDeadLetterParams = z.infer<typeof replayDeadLetterParamsSchema>
