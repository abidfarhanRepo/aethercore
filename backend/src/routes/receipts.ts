import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import { coreHookBus } from '../lib/hookBus'

export default async function receiptsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { receiptPublicId: string } }>('/api/receipts/:receiptPublicId', async (req, reply) => {
    const { receiptPublicId } = req.params

    const sale = await prisma.sale.findFirst({
      where: { receiptPublicId } as any,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: true,
      } as any,
    } as any)

    if (!sale) {
      return reply.status(404).send({
        error: 'Receipt not found',
        code: 'RECEIPT_NOT_FOUND',
      })
    }

    const saleRecord = sale as any

    await coreHookBus.emit('onReceiptRender', {
      saleId: saleRecord.id,
      receiptPublicId: saleRecord.receiptPublicId,
      terminalId: saleRecord.terminalId,
      syncState: saleRecord.syncState,
    })

    return {
      saleId: saleRecord.id,
      receiptPublicId: saleRecord.receiptPublicId,
      terminalId: saleRecord.terminalId,
      syncState: saleRecord.syncState,
      clientCreatedAt: saleRecord.clientCreatedAt,
      createdAt: saleRecord.createdAt,
      subtotalCents: saleRecord.subtotalCents,
      discountCents: saleRecord.discountCents,
      taxCents: saleRecord.taxCents,
      totalCents: saleRecord.totalCents,
      paymentMethod: saleRecord.paymentMethod,
      status: saleRecord.status,
      items: saleRecord.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name,
        sku: item.product?.sku,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountCents: item.discountCents,
      })),
      payments: saleRecord.payments.map((payment: any) => ({
        id: payment.id,
        method: payment.method,
        amountCents: payment.amountCents,
        reference: payment.reference,
      })),
    }
  })
}
