import { getToken } from './auth'
import type { OrgSummary } from './types'

async function request<T>(url: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }

  if (auth) {
    const token = getToken()
    if (token) {
      headers.authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || body.detail || `Request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export type LoginResponse =
  | { token: string; mfaRequired?: false }
  | { mfaRequired: true; tempToken: string }

export function login(username: string, password: string): Promise<LoginResponse> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, false)
}

export function verifyMfa(token: string, totp: string): Promise<{ token: string }> {
  return request('/api/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ token, totp }),
  }, false)
}

export function listOrgs(): Promise<{ orgs: OrgSummary[] }> {
  return request('/api/orgs')
}

export function provisionOrg(payload: {
  orgName: string
  traefikHost: string
  adminEmail: string
  adminPassword: string
  smtpHost: string
  smtpUser: string
  smtpPass: string
}): Promise<{ message: string }> {
  return request('/api/orgs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deprovisionOrg(org: string): Promise<{ message: string }> {
  return request(`/api/orgs/${org}/deprovision`, {
    method: 'POST',
    body: JSON.stringify({ confirmOrg: org }),
  })
}

export function backupOrg(org: string): Promise<{ message: string }> {
  return request(`/api/orgs/${org}/backup`, { method: 'POST' })
}

export function backupAll(): Promise<{ message: string }> {
  return request('/api/orgs/backup-all', { method: 'POST' })
}

export function restartOrg(org: string): Promise<{ message: string }> {
  return request(`/api/orgs/${org}/restart`, { method: 'POST' })
}

export function getOrgHealth(org: string): Promise<{ org: string; docker: OrgSummary['docker'] }> {
  return request(`/api/orgs/${org}/health`)
}

export function getOrgSettings(org: string): Promise<{ org: string; settings: Record<string, string> }> {
  return request(`/api/orgs/${org}/settings`)
}

export function updateOrgSettings(org: string, settings: Record<string, string>): Promise<{ org: string; settings: Record<string, string> }> {
  return request(`/api/orgs/${org}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  })
}
