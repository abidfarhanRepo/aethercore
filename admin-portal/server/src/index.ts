import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import path from 'node:path'
import speakeasy from 'speakeasy'
import { requireAuth } from './middleware/auth'
import { readEnvFile, updateEnvFile } from './utils/envFile'
import { getOrgCompose, getOrgDockerHealth, getOrgEnvFile, getOrgSummary, listOrgs, validateOrgName } from './utils/orgs'
import { runCommand, runScript } from './utils/process'

const app = express()

const port = Number(process.env.PORT || 4310)
const allowedOrigin = process.env.ADMIN_PORTAL_ALLOWED_ORIGIN || 'http://localhost:5177'
const adminUsername = process.env.ADMIN_PORTAL_USERNAME || 'admin'
const adminPassword = process.env.ADMIN_PORTAL_PASSWORD || 'change-me'
const totpSecret = process.env.ADMIN_PORTAL_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'
const mfaTempSecret = process.env.ADMIN_PORTAL_MFA_TEMP_SECRET || 'change-me-mfa-temp-secret'
const sessionSecret = process.env.ADMIN_PORTAL_JWT_SECRET || 'change-me-jwt-secret'
const tokenExpiresIn = (process.env.ADMIN_PORTAL_TOKEN_EXPIRES_IN || '8h') as SignOptions['expiresIn']
const mfaRequired = /^(1|true|yes|on)$/i.test(process.env.ADMIN_PORTAL_MFA_REQUIRED || '')
const rootDir = path.resolve(__dirname, '../../..')

app.use(cors({ origin: allowedOrigin, credentials: false }))
app.use(express.json())

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEqualSafe(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function ensureOrgOrThrow(org: string): void {
  if (!validateOrgName(org)) {
    const err = new Error('Invalid org name')
    ;(err as Error & { code?: number }).code = 400
    throw err
  }
}

function sanitizeSettingsInput(settings: Record<string, unknown>): Record<string, string> {
  const updates: Record<string, string> = {}
  const allowExact = new Set(['TRAEFIK_HOST', 'TENANT_IDLE_TIMEOUT_MINUTES', 'IDLE_TIMEOUT_MINUTES'])

  for (const [key, value] of Object.entries(settings)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      continue
    }

    const allowed = allowExact.has(key) || key.startsWith('SMTP_') || key.includes('IDLE_TIMEOUT')
    if (!allowed) {
      continue
    }

    updates[key] = String(value).trim()
  }

  return updates
}

type EnsuredAdminUser = {
  email: string
}

async function ensureProvisionedAdminUser(orgName: string, adminEmail: string, adminPasswordValue: string): Promise<EnsuredAdminUser> {
  const compose = getOrgCompose(orgName)
  const envFile = getOrgEnvFile(orgName)

  // Ensure org compose/env files exist before one-off seeding command.
  await Promise.all([fs.stat(compose), fs.stat(envFile)])

  const inlineScript = [
    "(async () => {",
    "  const { PrismaClient } = require('@prisma/client')",
    "  const bcrypt = require('bcryptjs')",
    "  const email = String(process.env.ADMIN_PROVISION_EMAIL || '').trim().toLowerCase()",
    "  const password = String(process.env.ADMIN_PROVISION_PASSWORD || '')",
    "",
    "  if (!email || password.length < 8) {",
    "    throw new Error('Invalid admin credentials payload')",
    "  }",
    "",
    "  const prisma = new PrismaClient()",
    "  try {",
    "    const passwordHash = await bcrypt.hash(password, 10)",
    "    const user = await prisma.user.upsert({",
    "      where: { email },",
    "      update: {",
    "        password: passwordHash,",
    "        role: 'ADMIN',",
    "        isActive: true,",
    "        mfaRecoveryCodes: [],",
    "      },",
    "      create: {",
    "        email,",
    "        password: passwordHash,",
    "        role: 'ADMIN',",
    "        isActive: true,",
    "        mfaRecoveryCodes: [],",
    "      },",
    "    })",
    "",
    "    process.stdout.write(`ADMIN_PROVISION_RESULT ${JSON.stringify({ ok: true, email: user.email })}\\n`)",
    "  } finally {",
    "    await prisma.$disconnect()",
    "  }",
    "})().catch((error) => {",
    "  const message = error instanceof Error ? error.stack || error.message : String(error)",
    "  process.stderr.write(`${message}\\n`)",
    "  process.exit(1)",
    "})",
  ].join('\n')

  const args = [
    'compose',
    '-f',
    compose,
    '--env-file',
    envFile,
    'run',
    '--rm',
    '-T',
    '-e',
    'ADMIN_PROVISION_EMAIL',
    '-e',
    'ADMIN_PROVISION_PASSWORD',
    'backend',
    'node',
    '-e',
    inlineScript,
  ]

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ADMIN_PROVISION_EMAIL: adminEmail,
    ADMIN_PROVISION_PASSWORD: adminPasswordValue,
  }

  const result = await runCommand('docker', args, rootDir, { env })
  const marker = /ADMIN_PROVISION_RESULT\s+(\{.*\})/m.exec(result.stdout)

  if (!marker?.[1]) {
    throw new Error('Admin user ensure step did not return a success marker')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(marker[1])
  } catch {
    throw new Error('Admin user ensure step returned malformed output')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Admin user ensure step returned invalid payload')
  }

  const payload = parsed as { ok?: unknown; email?: unknown }
  if (!payload.ok || typeof payload.email !== 'string' || !payload.email.trim()) {
    throw new Error('Admin user ensure step reported failure')
  }

  return { email: payload.email.trim() }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '')
  const password = String(req.body?.password || '')

  if (!isEqualSafe(username, adminUsername) || !isEqualSafe(password, adminPassword)) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  if (!mfaRequired) {
    const sessionToken = jwt.sign({ username, type: 'admin-session' }, sessionSecret, {
      expiresIn: tokenExpiresIn,
    })

    res.json({ token: sessionToken })
    return
  }

  const tempToken = jwt.sign({ username, type: 'mfa-temp' }, mfaTempSecret, { expiresIn: '5m' })
  res.json({ mfaRequired: true, tempToken })
})

app.post('/api/auth/mfa/verify', (req, res) => {
  const tempToken = String(req.body?.token || '')
  const totp = String(req.body?.totp || '').replace(/\s+/g, '')

  try {
    const payload = jwt.verify(tempToken, mfaTempSecret)
    if (typeof payload !== 'object' || !payload || payload.type !== 'mfa-temp') {
      res.status(401).json({ error: 'Invalid MFA token' })
      return
    }

    const verified = speakeasy.totp.verify({
      secret: totpSecret,
      encoding: 'base32',
      token: totp,
      window: 1,
    })

    if (!verified) {
      res.status(401).json({ error: 'Invalid TOTP code' })
      return
    }

    const username = String((payload as { username?: string }).username || adminUsername)
    const sessionToken = jwt.sign({ username, type: 'admin-session' }, sessionSecret, {
      expiresIn: tokenExpiresIn,
    })

    res.json({ token: sessionToken })
  } catch {
    res.status(401).json({ error: 'Invalid MFA token' })
  }
})

app.use('/api', requireAuth)

app.get('/api/orgs', async (_req, res) => {
  try {
    const orgs = await listOrgs()
    const data = await Promise.all(orgs.map((org) => getOrgSummary(org)))
    res.json({ orgs: data })
  } catch (error) {
    res.status(500).json({ error: 'Failed to list organizations', detail: String(error) })
  }
})

app.post('/api/orgs', async (req, res) => {
  const orgName = String(req.body?.orgName || '').trim()
  const traefikHost = String(req.body?.traefikHost || '').trim()
  const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase()
  const adminPasswordValue = String(req.body?.adminPassword || '')
  const smtpHost = String(req.body?.smtpHost || '').trim()
  const smtpUser = String(req.body?.smtpUser || '').trim()
  const smtpPass = String(req.body?.smtpPass || '').trim()

  if (!orgName || !traefikHost || !adminEmail || !adminPasswordValue || !smtpHost || !smtpUser || !smtpPass) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  if (!validateOrgName(orgName)) {
    res.status(400).json({ error: 'Invalid org name' })
    return
  }

  if (!emailPattern.test(adminEmail)) {
    res.status(400).json({ error: 'Invalid admin email' })
    return
  }

  if (adminPasswordValue.length < 8) {
    res.status(400).json({ error: 'adminPassword must be at least 8 characters' })
    return
  }

  try {
    const result = await runScript('deploy/scripts/provision-org.sh', [orgName, traefikHost, adminEmail, smtpHost, smtpUser, smtpPass], rootDir)
    try {
      const adminUser = await ensureProvisionedAdminUser(orgName, adminEmail, adminPasswordValue)
      res.status(201).json({
        message: 'Provision started/completed',
        output: result.stdout,
        adminUser: {
          success: true,
          email: adminUser.email,
        },
      })
      return
    } catch (seedError) {
      res.status(500).json({
        error: 'Provision succeeded but admin user ensure step failed',
        detail: String(seedError),
      })
      return
    }
  } catch (error) {
    res.status(500).json({ error: 'Provision failed', detail: String(error) })
  }
})

app.post('/api/orgs/:org/deprovision', async (req, res) => {
  const org = String(req.params.org || '').trim()
  const confirmOrg = String(req.body?.confirmOrg || '').trim()

  if (org !== confirmOrg) {
    res.status(400).json({ error: 'Confirmation org name mismatch' })
    return
  }

  if (!validateOrgName(org)) {
    res.status(400).json({ error: 'Invalid org name' })
    return
  }

  try {
    const result = await runScript('deploy/scripts/deprovision-org.sh', [org, confirmOrg], rootDir)
    res.json({ message: 'Deprovisioned', output: result.stdout })
  } catch (error) {
    res.status(500).json({ error: 'Deprovision failed', detail: String(error) })
  }
})

app.get('/api/orgs/:org/health', async (req, res) => {
  const org = String(req.params.org || '').trim()

  try {
    ensureOrgOrThrow(org)
    const docker = await getOrgDockerHealth(org)
    res.json({ org, docker })
  } catch (error) {
    const code = (error as Error & { code?: number }).code || 500
    res.status(code).json({ error: 'Failed to read health', detail: String(error) })
  }
})

app.get('/api/orgs/:org/settings', async (req, res) => {
  const org = String(req.params.org || '').trim()

  try {
    ensureOrgOrThrow(org)
    const envFile = getOrgEnvFile(org)
    const env = await readEnvFile(envFile)
    res.json({ org, settings: env })
  } catch (error) {
    const code = (error as Error & { code?: number }).code || 500
    res.status(code).json({ error: 'Failed to read settings', detail: String(error) })
  }
})

app.put('/api/orgs/:org/settings', async (req, res) => {
  const org = String(req.params.org || '').trim()

  try {
    ensureOrgOrThrow(org)
    const envFile = getOrgEnvFile(org)
    await fs.stat(envFile)

    const requested = (req.body?.settings || {}) as Record<string, unknown>
    const updates = sanitizeSettingsInput(requested)

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No allowed settings provided' })
      return
    }

    await updateEnvFile(envFile, updates)
    const settings = await readEnvFile(envFile)
    res.json({ org, settings })
  } catch (error) {
    const code = (error as Error & { code?: number }).code || 500
    res.status(code).json({ error: 'Failed to update settings', detail: String(error) })
  }
})

app.post('/api/orgs/:org/restart', async (req, res) => {
  const org = String(req.params.org || '').trim()

  try {
    ensureOrgOrThrow(org)
    const compose = getOrgCompose(org)
    const env = getOrgEnvFile(org)
    const result = await runCommand('docker', ['compose', '-f', compose, '--env-file', env, 'up', '-d', 'backend', 'frontend'])
    res.json({ message: 'Restart triggered', output: result.stdout })
  } catch (error) {
    const code = (error as Error & { code?: number }).code || 500
    res.status(code).json({ error: 'Restart failed', detail: String(error) })
  }
})

app.post('/api/orgs/:org/backup', async (req, res) => {
  const org = String(req.params.org || '').trim()

  try {
    ensureOrgOrThrow(org)
    const result = await runScript('deploy/scripts/backup-org.sh', [org], rootDir)
    res.json({ message: 'Backup completed', output: result.stdout })
  } catch (error) {
    const code = (error as Error & { code?: number }).code || 500
    res.status(code).json({ error: 'Backup failed', detail: String(error) })
  }
})

app.post('/api/orgs/backup-all', async (_req, res) => {
  try {
    const result = await runScript('deploy/scripts/backup-all.sh', [], rootDir)
    res.json({ message: 'Backup all completed', output: result.stdout })
  } catch (error) {
    res.status(500).json({ error: 'Backup all failed', detail: String(error) })
  }
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Admin portal API listening on ${port}`)
})
