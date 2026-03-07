const mockPrisma = {
  notificationQueue: {
    create: jest.fn(),
  },
}

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

jest.mock('../../src/utils/db', () => ({
  prisma: mockPrisma,
}))

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}))

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
    createTestAccount: jest.fn(),
  },
}))

import nodemailer from 'nodemailer'
import {
  createEtherealTransport,
  sendReceiptEmail,
  setEmailTransportForTests,
} from '../../src/lib/emailService'

describe('Email receipt integration', () => {
  const mockedNodemailer = nodemailer as unknown as {
    createTransport: jest.Mock
    createTestAccount: jest.Mock
  }

  const immediateTimeoutSpy = jest
    .spyOn(global, 'setTimeout')
    .mockImplementation((callback: any) => {
      callback()
      return 0 as any
    })

  beforeEach(() => {
    jest.clearAllMocks()
    setEmailTransportForTests(null)
  })

  afterAll(() => {
    immediateTimeoutSpy.mockRestore()
    setEmailTransportForTests(null)
  })

  it('creates Ethereal transport via nodemailer createTestAccount', async () => {
    mockedNodemailer.createTestAccount.mockResolvedValue({
      user: 'ethereal-user',
      pass: 'ethereal-pass',
    })

    const transportStub = { sendMail: jest.fn() }
    mockedNodemailer.createTransport.mockReturnValue(transportStub)

    const transport = await createEtherealTransport()

    expect(transport).toBe(transportStub)
    expect(mockedNodemailer.createTestAccount).toHaveBeenCalledTimes(1)
    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal-user',
        pass: 'ethereal-pass',
      },
    })
  })

  it('sends receipt email successfully', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' })
    mockedNodemailer.createTransport.mockReturnValue({ sendMail })

    await sendReceiptEmail('customer@example.com', 'rcpt-1', '<p>Receipt</p>')

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('retries and queues failed email after final attempt', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'))
    mockedNodemailer.createTransport.mockReturnValue({ sendMail })
    mockPrisma.notificationQueue.create.mockResolvedValue({ id: 'queue-1' })

    await expect(
      sendReceiptEmail('customer@example.com', 'rcpt-fail', '<p>Receipt</p>')
    ).rejects.toThrow('smtp down')

    expect(sendMail).toHaveBeenCalledTimes(3)
    expect(mockPrisma.notificationQueue.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.notificationQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'failed_email',
        receiptId: 'rcpt-fail',
        recipientEmail: 'customer@example.com',
        status: 'pending',
        attempts: 3,
      }),
    })
  })
})
