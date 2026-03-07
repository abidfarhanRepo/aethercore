const mockPrisma = {
  paymentProcessor: {
    findMany: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
  },
}

const mockSendReceiptEmail = jest.fn()

jest.mock('../../src/utils/db', () => ({
  prisma: mockPrisma,
}))

jest.mock('../../src/lib/emailService', () => ({
  sendReceiptEmail: mockSendReceiptEmail,
}))

import Fastify from 'fastify'
import paymentRoutes from '../../src/routes/payments'

describe('Payment receipt route integration', () => {
  const app = Fastify()

  beforeAll(async () => {
    mockPrisma.paymentProcessor.findMany.mockResolvedValue([])

    app.decorateRequest('jwtVerify', async function jwtVerify() {
      return true
    })

    await app.register(paymentRoutes)
    await app.ready()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.paymentProcessor.findMany.mockResolvedValue([])
  })

  afterAll(async () => {
    await app.close()
  })

  it('builds receipt and sends email with line items, subtotal, tax, and total', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay_123',
      amountCents: 3750,
      sale: {
        subtotalCents: 3000,
        taxCents: 750,
        items: [
          {
            qty: 2,
            unitPrice: 1000,
            product: { name: 'Pain Reliever' },
          },
          {
            qty: 1,
            unitPrice: 1000,
            product: { name: 'Vitamin C' },
          },
        ],
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/pay_123/receipt',
      payload: {
        recipientEmail: 'customer@example.com',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(mockSendReceiptEmail).toHaveBeenCalledTimes(1)

    const [to, receiptId, receiptHtml] = mockSendReceiptEmail.mock.calls[0]
    expect(to).toBe('customer@example.com')
    expect(receiptId).toBe('pay_123')
    expect(receiptHtml).toContain('Pain Reliever')
    expect(receiptHtml).toContain('Vitamin C')
    expect(receiptHtml).toContain('$30.00')
    expect(receiptHtml).toContain('$7.50')
    expect(receiptHtml).toContain('$37.50')
  })

  it('returns 404 when payment is not found', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/pay_missing/receipt',
      payload: {
        recipientEmail: 'customer@example.com',
      },
    })

    expect(response.statusCode).toBe(404)
    expect(mockSendReceiptEmail).not.toHaveBeenCalled()
  })
})
