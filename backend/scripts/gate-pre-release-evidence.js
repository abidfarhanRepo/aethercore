#!/usr/bin/env node

require('dotenv').config()
const axios = require('axios')
const {
  authedGet,
  isResolvedEvent,
  parseHours,
  resolveAuthToken,
  toDateOrNull,
  writeEvidence,
} = require('./release-gate-utils')

async function run() {
  const baseUrl = process.env.RELEASE_GATE_BASE_URL || process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000'
  const lookbackHours = parseHours(process.env.PRE_RELEASE_LOOKBACK_HOURS, 24)
  const cutoffMs = Date.now() - lookbackHours * 60 * 60 * 1000

  let pass = false
  let fatalError = null
  let tokenSource = 'n/a'

  const checks = {
    health: {
      pass: false,
      status: null,
      databaseOk: null,
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/health`,
    },
    unresolvedCriticalEvents24h: {
      pass: false,
      lookbackHours,
      count: null,
      samples: [],
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/security/events`,
    },
  }

  try {
    const healthResponse = await axios.get(checks.health.endpoint, {
      timeout: Number(process.env.RELEASE_GATE_HTTP_TIMEOUT_MS || 10000),
      validateStatus: () => true,
      headers: { accept: 'application/json' },
    })

    const healthData = healthResponse.data || {}
    const healthStatus = healthData.status
    const databaseOk = Boolean(healthData.checks && healthData.checks.database && healthData.checks.database.ok)
    checks.health.status = healthStatus || null
    checks.health.databaseOk = databaseOk
    checks.health.httpStatus = healthResponse.status
    checks.health.pass = ['ok', 'degraded'].includes(healthStatus) && databaseOk === true

    const auth = await resolveAuthToken(baseUrl)
    tokenSource = auth.source

    const eventsResponse = await authedGet(baseUrl, '/api/security/events', auth.token, { limit: 200 })

    if (!eventsResponse.ok) {
      throw new Error(`Security events request failed with status ${eventsResponse.status}`)
    }

    const items = Array.isArray(eventsResponse.data && eventsResponse.data.items) ? eventsResponse.data.items : []
    const unresolvedCritical = items.filter((event) => {
      const severity = event && typeof event.severity === 'string' ? event.severity.toUpperCase() : ''
      if (severity !== 'CRITICAL') return false
      if (isResolvedEvent(event)) return false

      const createdAt = toDateOrNull(event.createdAt)
      return createdAt ? createdAt.getTime() >= cutoffMs : false
    })

    checks.unresolvedCriticalEvents24h.count = unresolvedCritical.length
    checks.unresolvedCriticalEvents24h.samples = unresolvedCritical.slice(0, 10).map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      source: event.source,
      message: event.message,
      severity: event.severity,
    }))
    checks.unresolvedCriticalEvents24h.pass = unresolvedCritical.length === 0

    pass = checks.health.pass && checks.unresolvedCriticalEvents24h.pass
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error)
  }

  const evidence = {
    pass,
    baseUrl,
    tokenSource,
    checks,
    fatalError,
  }

  const files = writeEvidence('pre-release-health-security-gate', evidence)

  console.log(`Pre-release evidence gate ${pass ? 'PASSED' : 'FAILED'}`)
  console.log(`artifact=${files.filePath}`)
  console.log(`artifact_latest=${files.stablePath}`)

  if (!pass) {
    if (fatalError) {
      console.error(fatalError)
    }
    process.exit(1)
  }

  process.exit(0)
}

run()
