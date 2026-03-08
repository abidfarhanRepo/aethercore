import { z } from 'zod'
import { idSchema } from './common'

export const inventoryListQuerySchema = z.object({
  warehouseId: idSchema.optional(),
})

export const inventoryProductParamsSchema = z.object({
  productId: idSchema,
})

export const adjustInventoryBodySchema = z.object({
  productId: idSchema,
  warehouseId: idSchema.optional(),
  qtyDelta: z.number().int(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  costPerUnit: z.number().nonnegative().optional(),
})

export const transferInventoryBodySchema = z.object({
  productId: idSchema,
  fromWarehouseId: idSchema,
  toWarehouseId: idSchema,
  qty: z.number().int().positive(),
  notes: z.string().trim().optional(),
})

export const recountInventoryBodySchema = z.object({
  warehouseId: idSchema,
  sessionName: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  items: z.array(z.object({
    productId: idSchema,
    countedQty: z.number().int().nonnegative(),
  })).min(1),
})

export const warehouseInitBodySchema = z.object({
  name: z.string().trim().optional(),
  location: z.string().trim().optional(),
  address: z.string().trim().optional(),
}).optional()

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>
export type InventoryProductParams = z.infer<typeof inventoryProductParamsSchema>
export type AdjustInventoryBody = z.infer<typeof adjustInventoryBodySchema>
export type TransferInventoryBody = z.infer<typeof transferInventoryBodySchema>
export type RecountInventoryBody = z.infer<typeof recountInventoryBodySchema>
export type WarehouseInitBody = z.infer<typeof warehouseInitBodySchema>
