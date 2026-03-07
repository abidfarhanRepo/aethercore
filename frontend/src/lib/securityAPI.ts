import { api } from './api'

export interface SecurityStatusResponse {
  status: string
  checkedAt: string
  https: {
    enforced: boolean
    source: string
    known: boolean
  }
  tls: {
    keyPath: { configured: boolean; sourceEnv: string }
    certPath: { configured: boolean; sourceEnv: string }
    caPath: { configured: boolean; sourceEnv: string }
    certificateMetadata: {
      subject: string | null
      issuer: string | null
      validFrom: string | null
      validTo: string | null
      availability: {
        subject: boolean
        issuer: boolean
        validityWindow: boolean
      }
    }
  }
  headers: Record<string, unknown>
  unknowns: string[]
  notes: string[]
  requestContext: {
    requestId: string | null
    observedProtocol: string
    sslTermination: string
  }
}

export interface SecurityEventItem {
  id: string
  eventType: string
  severity: string
  source: string
  message: string
  details?: Record<string, unknown>
  actorId?: string | null
  ipAddress?: string | null
  createdAt: string
}

export interface KeyRotationItem {
  id: string
  component: string
  oldKeyVersion?: string | null
  newKeyVersion?: string | null
  status: string
  details?: Record<string, unknown>
  actorId?: string | null
  rotatedAt: string
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: {
    database: { ok: boolean; latencyMs: number; error?: string }
    redis: { ok: boolean; latencyMs: number; error?: string }
    security: {
      status: string
      httpsEnforced: boolean
      tlsConfigured: boolean
      checkedAt: string
      notes: string[]
    }
  }
}

export type AlertRuleType = 'auth_spike' | 'security_status_failure' | 'cert_expiry' | 'backup_failure'

export interface AlertRuleConfig {
  enabled: boolean
  threshold: number
  windowMinutes: number
}

export interface AlertRulesConfig {
  routingPolicy: {
    notifyAdminManager: boolean
  }
  rules: Record<AlertRuleType, AlertRuleConfig>
}

export interface AlertEvaluationResult {
  checkedAt: string
  triggered: Array<{
    rule: AlertRuleType
    value: number
    threshold: number
    windowMinutes: number
    message: string
  }>
}

export const securityAPI = {
  getStatus: () => api.get<SecurityStatusResponse>('/api/v1/security/status'),
  getEvents: (limit = 50) => api.get<{ items: SecurityEventItem[]; meta: { limit: number; count: number } }>(`/api/v1/security/events?limit=${limit}`),
  getKeyRotations: (limit = 50) =>
    api.get<{ items: KeyRotationItem[]; meta: { limit: number; count: number } }>(`/api/v1/security/key-rotations?limit=${limit}`),
  rotateKeys: (payload: { component: 'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings'; newVersion: string; notes?: string }) =>
    api.post('/api/v1/security/rotate-keys', payload),
  getAlertRules: () => api.get<{ config: AlertRulesConfig }>('/api/v1/security/alert-rules'),
  updateAlertRules: (payload: Partial<AlertRulesConfig>) =>
    api.put<{ config: AlertRulesConfig }>('/api/v1/security/alert-rules', payload),
  evaluateAlertRules: () => api.post<{ evaluation: AlertEvaluationResult }>('/api/v1/security/alert-rules/evaluate'),
  getHealth: () => api.get<HealthResponse>('/api/v1/health'),
}
