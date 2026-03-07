#!/usr/bin/env node

require('dotenv').config()
const {
  authedGet,
  parseBool,
  parseHours,
  resolveAuthToken,
  toDateOrNull,
  writeEvidence,
} = require('./release-gate-utils')

function hasRotationNotification(items, component) {
  return items.some((item) => {
    const title = typeof item.title === 'string' ? item.title.toLowerCase() : ''
    const message = typeof item.message === 'string' ? item.message.toLowerCase() : ''
    const type = typeof item.type === 'string' ? item.type.toUpperCase() : ''
    const metadata = item && typeof item.metadata === 'object' && item.metadata ? item.metadata : {}
    const metadataComponent = typeof metadata.component === 'string' ? metadata.component : ''

    const mentionsRotation = title.includes('key rotation') || message.includes('key rotation')
    const matchesComponent = component ? metadataComponent === component : true
    return type === 'SECURITY' && mentionsRotation && matchesComponent
  })
}

async function collectNotifications(baseUrl, token) {
  const response = await authedGet(baseUrl, '/api/notifications', token, {
    includeArchived: 'true',
    limit: 200,
  })

  if (!response.ok) {
    throw new Error(`Notifications request failed with status ${response.status}`)
  }

  return Array.isArray(response.data && response.data.notifications) ? response.data.notifications : []
}

async function run() {
  const baseUrl = process.env.RELEASE_GATE_BASE_URL || process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000'
  const lookbackHours = parseHours(process.env.POST_RELEASE_LOOKBACK_HOURS, 24)
  const cutoffMs = Date.now() - lookbackHours * 60 * 60 * 1000
  const requireManagerEvidence = parseBool(process.env.POST_RELEASE_REQUIRE_MANAGER_EVIDENCE, false)

  let pass = false
  let fatalError = null

  const checks = {
    keyRotationRecent: {
      pass: false,
      lookbackHours,
      totalQueried: 0,
      recentCount: 0,
      latestRotation: null,
    },
    notificationFanout: {
      pass: false,
      requireManagerEvidence,
      adminVisible: false,
      managerVisible: null,
      managerEvidenceAttempted: false,
    },
  }

  const authSources = {
    admin: 'n/a',
    manager: 'n/a',
  }

  try {
    const adminAuth = await resolveAuthToken(baseUrl)
    authSources.admin = adminAuth.source

    const rotationResponse = await authedGet(baseUrl, '/api/security/key-rotations', adminAuth.token, { limit: 200 })

    if (!rotationResponse.ok) {
      throw new Error(`Key rotations request failed with status ${rotationResponse.status}`)
    }

    const rotations = Array.isArray(rotationResponse.data && rotationResponse.data.items) ? rotationResponse.data.items : []
    checks.keyRotationRecent.totalQueried = rotations.length

    const recentRotations = rotations.filter((rotation) => {
      const rotatedAt = toDateOrNull(rotation.rotatedAt)
      if (!rotatedAt) return false
      return rotatedAt.getTime() >= cutoffMs
    })

    checks.keyRotationRecent.recentCount = recentRotations.length
    checks.keyRotationRecent.latestRotation = recentRotations.length > 0 ? recentRotations[0] : null
    checks.keyRotationRecent.pass = recentRotations.length > 0

    const latestComponent =
      checks.keyRotationRecent.latestRotation && checks.keyRotationRecent.latestRotation.component
        ? checks.keyRotationRecent.latestRotation.component
        : ''

    const adminNotifications = await collectNotifications(baseUrl, adminAuth.token)
    checks.notificationFanout.adminVisible = hasRotationNotification(adminNotifications, latestComponent)

    const managerToken = process.env.RELEASE_GATE_MANAGER_BEARER_TOKEN || ''
    const managerEmail = process.env.RELEASE_GATE_MANAGER_EMAIL || ''
    const managerPassword = process.env.RELEASE_GATE_MANAGER_PASSWORD || ''

    if (managerToken || (managerEmail && managerPassword)) {
      checks.notificationFanout.managerEvidenceAttempted = true
      const managerAuth = await resolveAuthToken(baseUrl, {
        explicitToken: managerToken,
        email: managerEmail,
        password: managerPassword,
      })
      authSources.manager = managerAuth.source
      const managerNotifications = await collectNotifications(baseUrl, managerAuth.token)
      checks.notificationFanout.managerVisible = hasRotationNotification(managerNotifications, latestComponent)
    }

    if (checks.notificationFanout.managerVisible === null) {
      checks.notificationFanout.pass = requireManagerEvidence
        ? false
        : checks.notificationFanout.adminVisible
    } else {
      checks.notificationFanout.pass = checks.notificationFanout.adminVisible && checks.notificationFanout.managerVisible
    }

    pass = checks.keyRotationRecent.pass && checks.notificationFanout.pass
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error)
  }

  const evidence = {
    pass,
    baseUrl,
    authSources,
    checks,
    fatalError,
  }

  const files = writeEvidence('post-release-security-evidence-gate', evidence)

  console.log(`Post-release evidence gate ${pass ? 'PASSED' : 'FAILED'}`)
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
