import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'

export default async function purchaseRoutes(fastify: FastifyInstance){
  // create purchase order (not yet received)
  const createPoSchema = {
    body: {
      type: 'object',
      required: ['items'],
      properties: {
        userId: { type: 'string' },
        items: { type: 'array', minItems: 1, items: { type: 'object', required: ['productId','qty','unitPrice'], properties: { productId: { type: 'string' }, qty: { type: 'number' }, unitPrice: { type: 'number' } } } }
      }
    }
  }

  fastify.post('/api/v1/purchases', { schema: createPoSchema }, async (req, reply)=>{
    const body = req.body as any
    const items: { productId: string; qty: number; unitPrice: number }[] = body.items

    try{
      const result = await (prisma as any).$transaction(async (tx:any)=>{
        const total = items.reduce((s,it)=>s + it.qty * it.unitPrice, 0)
        const po = await tx.purchaseOrder.create({ data: { userId: body.userId||'system', totalCents: total, status: 'pending' } })
        for(const it of items){
          await tx.purchaseOrderItem.create({ data: { purchaseOrderId: po.id, productId: it.productId, qty: it.qty, unitPrice: it.unitPrice } })
        }
        return { purchaseOrderId: po.id, totalCents: total }
      })
      return result
    }catch(e:any){
      fastify.log.error(e)
      return reply.status(500).send({ error: 'failed to create purchase order', detail: e.message })
    }
  })

  // receive items for a purchase order
  const receiveSchema = {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: { type: 'object', required: ['items'], properties: { userId: { type: 'string' }, items: { type: 'array', minItems: 1, items: { type: 'object', required: ['productId','qty'], properties: { productId: { type: 'string' }, qty: { type: 'number' } } } } } }
  }

  fastify.post('/api/v1/purchases/:id/receive', { schema: receiveSchema }, async (req, reply)=>{
    const id = (req.params as any).id
    const body = req.body as any
    const items: { productId: string; qty: number }[] = body.items

    try{
      const result = await (prisma as any).$transaction(async (tx:any)=>{
        const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } })
        if(!po) throw new Error('purchase order not found')
        // create inventory transactions and mark order received
        for(const it of items){
          await tx.inventoryTransaction.create({ data: { productId: it.productId, qtyDelta: it.qty, type: 'purchase', createdBy: body.userId||'system' } })
        }
        await tx.purchaseOrder.update({ where: { id }, data: { status: 'received' } })
        return { purchaseOrderId: id }
      })
      return result
    }catch(e:any){
      fastify.log.error(e)
      return reply.status(500).send({ error: 'failed to receive', detail: e.message })
    }
  })

  fastify.get('/api/v1/purchases/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } }, async (req, reply)=>{
    const id = (req.params as any).id
    const po = await (prisma as any).purchaseOrder.findUnique({ where: { id }, include: { items: true } })
    if(!po) return reply.status(404).send({ error: 'not found' })
    return po
  })

  fastify.get('/api/v1/purchases', async ()=>{
    return (prisma as any).purchaseOrder.findMany({ include: { items: true } })
  })
}
