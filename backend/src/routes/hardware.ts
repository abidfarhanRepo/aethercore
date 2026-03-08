import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import { requireAuth } from '../plugins/authMiddleware'

type HardwareDevice = {
  id: string
  name: string
  model: string
  connectionType: 'usb' | 'network' | 'serial' | 'bluetooth' | 'hid'
  connectionValue: string
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

type PrintDesignSettings = {
  paperWidth: number
  showLogo: boolean
  headerText: string
  footerText: string
  fontStyle: string
  fontSize: string
  separatorStyle: 'dashed' | 'double' | 'none'
  showStoreName: boolean
  showReceiptId: boolean
  showTimestamp: boolean
  showItems: boolean
  showItemDetails: boolean
  showSubtotal: boolean
  showDiscounts: boolean
  showTax: boolean
  showTotal: boolean
  showPaymentSection: boolean
  showPaymentBreakdown: boolean
  showChange: boolean
  showCashier: boolean
  showThankYou: boolean
}

const PRINTERS_KEY = 'hardware_printers'
const SCANNERS_KEY = 'hardware_scanners'
const PRINT_SETTINGS_KEY = 'printer_design_settings'

function nowIso() {
  return new Date().toISOString()
}

async function getSettingValue(key: string): Promise<string | null> {
  const row = await prisma.settings.findUnique({ where: { key } })
  return row?.value || null
}

async function upsertJsonSetting(
  key: string,
  value: unknown,
  label: string,
  description: string
) {
  await prisma.settings.upsert({
    where: { key },
    update: {
      value: JSON.stringify(value),
      type: 'json',
      category: 'payment',
      label,
      description,
    },
    create: {
      key,
      value: JSON.stringify(value),
      type: 'json',
      category: 'payment',
      label,
      description,
    },
  })
}

async function getDevices(key: string): Promise<HardwareDevice[]> {
  const raw = await getSettingValue(key)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function setDevices(key: string, devices: HardwareDevice[]) {
  const label = key === PRINTERS_KEY ? 'Hardware Printers' : 'Hardware Scanners'
  const description =
    key === PRINTERS_KEY
      ? 'Registered receipt printers'
      : 'Registered barcode scanners'

  await upsertJsonSetting(key, devices, label, description)
}

async function getPrintSettings(): Promise<PrintDesignSettings> {
  const fallback: PrintDesignSettings = {
    paperWidth: 48,
    showLogo: false,
    headerText: 'THANK YOU FOR YOUR PURCHASE',
    footerText: 'Come Again Soon!',
    fontStyle: 'normal',
    fontSize: 'medium',
    separatorStyle: 'dashed',
    showStoreName: true,
    showReceiptId: true,
    showTimestamp: true,
    showItems: true,
    showItemDetails: true,
    showSubtotal: true,
    showDiscounts: true,
    showTax: true,
    showTotal: true,
    showPaymentSection: true,
    showPaymentBreakdown: true,
    showChange: true,
    showCashier: false,
    showThankYou: true,
  }

  const raw = await getSettingValue(PRINT_SETTINGS_KEY)
  if (!raw) return fallback

  try {
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

function buildTestPrintContent(
  printerName: string,
  settings: PrintDesignSettings
): string {
  const width = Math.max(24, settings.paperWidth)
  const separatorChar =
    settings.separatorStyle === 'double'
      ? '='
      : settings.separatorStyle === 'none'
        ? ' '
        : '-'
  const line = separatorChar.repeat(width)

  const rows: string[] = []
  rows.push(line)
  rows.push(settings.showLogo ? '[LOGO]' : '[NO LOGO]')
  if (settings.showStoreName) rows.push('AETHER POS SYSTEM')
  if (settings.showReceiptId) rows.push('Receipt #TEST-0001')
  if (settings.showTimestamp) rows.push(new Date().toLocaleString())
  if (settings.headerText) rows.push(settings.headerText)
  rows.push(`Printer: ${printerName}`)
  rows.push(`Font: ${settings.fontStyle} (${settings.fontSize})`)
  rows.push(line)

  if (settings.showItems) {
    rows.push('Items')
    if (settings.showItemDetails) {
      rows.push('Demo Item x1            9.99')
      rows.push('  @ 9.99 each')
    } else {
      rows.push('Demo Item               9.99')
    }
    rows.push(line)
  }

  if (settings.showSubtotal) rows.push('Subtotal:               9.99')
  if (settings.showDiscounts) rows.push('Discount:              -0.00')
  if (settings.showTax) rows.push('Tax:                    0.00')
  if (settings.showTotal) {
    rows.push(line)
    rows.push('TOTAL:                  9.99')
  }

  if (settings.showPaymentSection) {
    rows.push(line)
    rows.push('Payment')
    if (settings.showPaymentBreakdown) rows.push('CASH                    10.00')
    if (settings.showChange) rows.push('Change:                 0.01')
  }

  rows.push(line)
  if (settings.showThankYou) rows.push('Thank you for your purchase!')
  if (settings.showCashier) rows.push('Cashier: Demo Cashier')
  if (settings.footerText) rows.push(settings.footerText)
  rows.push(line)

  return rows.join('\n')
}

export default async function hardwareRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/hardware/printers', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return
    const printers = await getDevices(PRINTERS_KEY)
    return reply.send({ success: true, printers })
  })

  fastify.post<{
    Body: Omit<HardwareDevice, 'id' | 'createdAt' | 'updatedAt'>
  }>('/api/v1/hardware/printers', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const printers = await getDevices(PRINTERS_KEY)
    const created: HardwareDevice = {
      ...req.body,
      id: `printer_${Date.now()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    printers.push(created)
    await setDevices(PRINTERS_KEY, printers)

    return reply.code(201).send({ success: true, printer: created })
  })

  fastify.put<{
    Params: { id: string }
    Body: Partial<Omit<HardwareDevice, 'id' | 'createdAt' | 'updatedAt'>>
  }>('/api/v1/hardware/printers/:id', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const { id } = req.params
    const printers = await getDevices(PRINTERS_KEY)
    const index = printers.findIndex((p) => p.id === id)

    if (index === -1) {
      return reply.code(404).send({ error: 'Printer not found' })
    }

    printers[index] = {
      ...printers[index],
      ...req.body,
      updatedAt: nowIso(),
    }

    await setDevices(PRINTERS_KEY, printers)
    return reply.send({ success: true, printer: printers[index] })
  })

  fastify.post<{
    Params: { id: string }
  }>('/api/v1/hardware/printers/:id/test-print', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const printers = await getDevices(PRINTERS_KEY)
    const printer = printers.find((p) => p.id === req.params.id)
    if (!printer) {
      return reply.code(404).send({ error: 'Printer not found' })
    }

    const printSettings = await getPrintSettings()
    const payload = buildTestPrintContent(printer.name, printSettings)

    return reply.send({
      success: true,
      message: 'Test print payload generated',
      payload,
      settings: printSettings,
    })
  })

  fastify.get('/api/v1/hardware/scanners', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return
    const scanners = await getDevices(SCANNERS_KEY)
    return reply.send({ success: true, scanners })
  })

  fastify.post<{
    Body: Omit<HardwareDevice, 'id' | 'createdAt' | 'updatedAt'>
  }>('/api/v1/hardware/scanners', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const scanners = await getDevices(SCANNERS_KEY)
    const created: HardwareDevice = {
      ...req.body,
      id: `scanner_${Date.now()}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    scanners.push(created)
    await setDevices(SCANNERS_KEY, scanners)

    return reply.code(201).send({ success: true, scanner: created })
  })

  fastify.put<{
    Params: { id: string }
    Body: Partial<Omit<HardwareDevice, 'id' | 'createdAt' | 'updatedAt'>>
  }>('/api/v1/hardware/scanners/:id', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const { id } = req.params
    const scanners = await getDevices(SCANNERS_KEY)
    const index = scanners.findIndex((s) => s.id === id)

    if (index === -1) {
      return reply.code(404).send({ error: 'Scanner not found' })
    }

    scanners[index] = {
      ...scanners[index],
      ...req.body,
      updatedAt: nowIso(),
    }

    await setDevices(SCANNERS_KEY, scanners)
    return reply.send({ success: true, scanner: scanners[index] })
  })

  fastify.get('/api/v1/hardware/print-settings', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return
    const settings = await getPrintSettings()
    return reply.send({ success: true, settings })
  })

  fastify.put<{
    Body: Partial<PrintDesignSettings>
  }>('/api/v1/hardware/print-settings', async (req, reply) => {
    await requireAuth(req, reply)
    if (reply.sent) return

    const current = await getPrintSettings()
    const updated = { ...current, ...req.body }

    await upsertJsonSetting(
      PRINT_SETTINGS_KEY,
      updated,
      'Printer Design Settings',
      'Layout and styling settings for printed receipts'
    )

    return reply.send({ success: true, settings: updated })
  })
}
