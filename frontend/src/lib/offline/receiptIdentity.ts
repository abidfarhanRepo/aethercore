const TERMINAL_ID_KEY = 'aether.terminalId'
const RECEIPT_COUNTER_PREFIX = 'aether.receiptCounter.'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function getDateKey(at: Date): string {
  const year = at.getFullYear()
  const month = pad2(at.getMonth() + 1)
  const day = pad2(at.getDate())
  return `${year}${month}${day}`
}

function randomToken(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(length)
    crypto.getRandomValues(buffer)
    for (let i = 0; i < length; i++) {
      out += chars[buffer[i] % chars.length]
    }
    return out
  }

  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }

  return out
}

export function getOrCreateTerminalId(): string {
  const existing = localStorage.getItem(TERMINAL_ID_KEY)
  if (existing) {
    return existing
  }

  const terminalId = `tm-${Date.now().toString(36)}-${randomToken(6)}`
  localStorage.setItem(TERMINAL_ID_KEY, terminalId)
  return terminalId
}

export function generateOfflineOpId(): string {
  const ts = Date.now().toString(36)
  const perfPart = Math.floor(performance.now()).toString(36)
  const rand = randomToken(10)
  return `op-${ts}-${perfPart}-${rand}`
}

export function generateReceiptPublicId(terminalId: string, at: Date = new Date()): string {
  const dateKey = getDateKey(at)
  const terminalSuffix = terminalId.slice(-4).toUpperCase()
  const counterKey = `${RECEIPT_COUNTER_PREFIX}${dateKey}`

  const current = Number(localStorage.getItem(counterKey) || '0')
  const next = current + 1
  localStorage.setItem(counterKey, String(next))

  const counter = String(next).padStart(4, '0')
  return `R-${terminalSuffix}-${dateKey}-${counter}`
}
