import nodemailer, { Transporter } from 'nodemailer'
import { prisma } from '../utils/db'
import { logger } from '../utils/logger'

const MAX_ATTEMPTS = 3
const BACKOFF_MS = 2000

let transport: Transporter | null = null

export function setEmailTransportForTests(nextTransport: Transporter | null): void {
  transport = nextTransport
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getTransport(): Transporter {
  if (transport) {
    return transport
  }

  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  return transport
}

export async function createEtherealTransport(): Promise<Transporter> {
  const account = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  })
}

function buildReceiptSubject(receiptId: string): string {
  return `Aether POS Receipt ${receiptId}`
}

async function queueFailedEmail(
  to: string,
  receiptId: string,
  html: string,
  error: string
): Promise<void> {
  await prisma.notificationQueue.create({
    data: {
      type: 'failed_email',
      receiptId,
      recipientEmail: to,
      subject: buildReceiptSubject(receiptId),
      htmlContent: html,
      status: 'pending',
      attempts: MAX_ATTEMPTS,
      error,
    },
  })
}

export async function sendReceiptEmail(
  to: string,
  receiptId: string,
  receiptHtml: string
): Promise<void> {
  const from = process.env.SMTP_FROM || 'noreply@aether.local'
  const subject = buildReceiptSubject(receiptId)

  let lastError: unknown = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await getTransport().sendMail({
        from,
        to,
        subject,
        html: receiptHtml,
      })
      logger.info({ to, receiptId, attempt }, 'Receipt email sent')
      return
    } catch (error) {
      lastError = error
      logger.warn(
        {
          to,
          receiptId,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        },
        'Receipt email send attempt failed'
      )

      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_MS)
      }
    }
  }

  const failureMessage =
    lastError instanceof Error ? lastError.message : String(lastError)

  logger.error(
    { to, receiptId, error: failureMessage },
    'Receipt email failed after retries'
  )

  try {
    await queueFailedEmail(to, receiptId, receiptHtml, failureMessage)
  } catch (queueError) {
    logger.error(
      {
        to,
        receiptId,
        error: queueError instanceof Error ? queueError.message : String(queueError),
      },
      'Failed to persist failed email notification'
    )
  }

  throw lastError instanceof Error ? lastError : new Error(failureMessage)
}
