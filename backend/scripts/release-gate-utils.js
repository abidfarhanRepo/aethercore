#!/usr/bin/env node

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const axios = require('axios')

function parseBool(value, fallback = false) {
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function resolveArtifactDir() {
  return process.env.RELEASE_GATE_ARTIFACT_DIR || path.join(process.cwd(), 'artifacts', 'release-gates')
}

function ensureArtifactDir() {
  const dir = resolveArtifactDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeEvidence(gateKey, payload) {
  const dir = ensureArtifactDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `${gateKey}.${timestamp}.json`
  const stableName = `${gateKey}.latest.json`

  const fullPayload = {
    generatedAt: new Date().toISOString(),
    gate: gateKey,
    ...payload,
  }

  const output = `${JSON.stringify(fullPayload, null, 2)}\n`
  const filePath = path.join(dir, fileName)
  const stablePath = path.join(dir, stableName)

  fs.writeFileSync(filePath, output, 'utf8')
  fs.writeFileSync(stablePath, output, 'utf8')

  return { dir, filePath, stablePath }
}

async function resolveAuthToken(baseUrl, options = {}) {
  const token = process.env.RELEASE_GATE_BEARER_TOKEN || options.explicitToken || ''
  if (token.trim()) {
    return { token: token.trim(), source: 'env:RELEASE_GATE_BEARER_TOKEN' }
  }

  const email = options.email || process.env.RELEASE_GATE_ADMIN_EMAIL || 'admin@aether.dev'
  const password =
    options.password || process.env.RELEASE_GATE_ADMIN_PASSWORD || process.env.DEV_ADMIN_PASSWORD || 'password123'

  const loginUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/login`
  const response = await axios.post(
    loginUrl,
    { email, password },
    {
      timeout: Number(process.env.RELEASE_GATE_HTTP_TIMEOUT_MS || 10000),
      validateStatus: () => true,
      headers: { 'content-type': 'application/json' },
    }
  )

  if (response.status >= 400) {
    const error = new Error(`Login failed with status ${response.status}`)
    error.responseBody = response.data
    throw error
  }

  const accessToken = response.data && response.data.accessToken
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Login succeeded but accessToken is missing in response')
  }

  return { token: accessToken, source: `login:${email}` }
}

async function authedGet(baseUrl, routePath, token, params) {
  const url = `${baseUrl.replace(/\/$/, '')}${routePath}`
  const response = await axios.get(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
    timeout: Number(process.env.RELEASE_GATE_HTTP_TIMEOUT_MS || 10000),
    params,
    validateStatus: () => true,
  })

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data: response.data,
    url,
  }
}

function parseHours(envValue, fallback) {
  const parsed = Number(envValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function toDateOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isResolvedEvent(event) {
  const details = event && typeof event.details === 'object' && event.details ? event.details : {}
  const resolved = details.resolved
  const status = typeof details.status === 'string' ? details.status.toLowerCase() : ''
  return resolved === true || ['resolved', 'closed', 'fixed'].includes(status)
}

module.exports = {
  authedGet,
  isResolvedEvent,
  parseBool,
  parseHours,
  resolveAuthToken,
  toDateOrNull,
  writeEvidence,
}
