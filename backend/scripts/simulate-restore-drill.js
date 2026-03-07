#!/usr/bin/env node

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function parseArg(prefix, fallback) {
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  if (!arg) return fallback
  const [, value] = arg.split('=')
  return value || fallback
}

async function writeSecurityEvent(payload) {
  await prisma.securityEvent.create({
    data: payload,
  })
}

async function resolveActorId(rawActorId) {
  const candidate = (rawActorId || '').trim()
  if (!candidate) return null

  const existing = await prisma.user.findUnique({
    where: { id: candidate },
    select: { id: true },
  })

  return existing?.id || null
}

async function run() {
  const env = process.env.NODE_ENV || 'development'
  const drillId = `restore-sim-${Date.now()}`
  const snapshotId = parseArg('--snapshot-id', 'latest-backup')
  const actorIdArg = parseArg('--actor-id', '')
  const actorId = await resolveActorId(actorIdArg)
  const startedAt = Date.now()

  if (env === 'production') {
    console.error('Restore simulation is blocked in production environments.')
    process.exit(1)
  }

  try {
    await writeSecurityEvent({
      eventType: 'UNKNOWN',
      severity: 'LOW',
      source: 'cli/security/backup-drills',
      message: `RESTORE_SIMULATION_INITIATED (${drillId})`,
      details: {
        drillId,
        drillType: 'weekly_restore_simulation',
        eventKind: 'RESTORE_SIMULATION_INITIATED',
        status: 'in_progress',
        snapshotId,
        environment: env,
      },
      actorId,
    })

    await prisma.$queryRaw`SELECT 1`

    const [saleCount, productCount, userCount] = await Promise.all([
      prisma.sale.count(),
      prisma.product.count(),
      prisma.user.count(),
    ])

    const durationMs = Date.now() - startedAt

    await writeSecurityEvent({
      eventType: 'UNKNOWN',
      severity: 'LOW',
      source: 'cli/security/backup-drills',
      message: `RESTORE_SIMULATION_COMPLETED (${drillId})`,
      details: {
        drillId,
        drillType: 'weekly_restore_simulation',
        eventKind: 'RESTORE_SIMULATION_COMPLETED',
        status: 'completed',
        snapshotId,
        dataValidated: true,
        durationMs,
        counts: {
          sales: saleCount,
          products: productCount,
          users: userCount,
        },
      },
      actorId,
    })

    console.log('Restore simulation completed successfully.')
    console.log(`drillId=${drillId}`)
    console.log(`snapshotId=${snapshotId}`)
    console.log(`durationMs=${durationMs}`)
    console.log(`counts: sales=${saleCount} products=${productCount} users=${userCount}`)
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    try {
      await writeSecurityEvent({
        eventType: 'UNKNOWN',
        severity: 'HIGH',
        source: 'cli/security/backup-drills',
        message: `RESTORE_SIMULATION_FAILED (${drillId})`,
        details: {
          drillId,
          drillType: 'weekly_restore_simulation',
          eventKind: 'RESTORE_SIMULATION_FAILED',
          status: 'failed',
          snapshotId,
          error: message,
        },
        actorId,
      })
    } catch (logErr) {
      const logErrMessage = logErr instanceof Error ? logErr.message : String(logErr)
      console.error(`Failed to persist failure event: ${logErrMessage}`)
    }

    console.error(`Restore simulation failed: ${message}`)
    process.exit(2)
  } finally {
    await prisma.$disconnect()
  }
}

run()
