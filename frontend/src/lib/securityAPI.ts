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

export const securityAPI = {
  getStatus: () => api.get<SecurityStatusResponse>('/api/security/status'),
  getEvents: (limit = 50) => api.get<{ items: SecurityEventItem[]; meta: { limit: number; count: number } }>(`/api/security/events?limit=${limit}`),
  getKeyRotations: (limit = 50) =>
    api.get<{ items: KeyRotationItem[]; meta: { limit: number; count: number } }>(`/api/security/key-rotations?limit=${limit}`),
  rotateKeys: (payload: { component: 'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings'; newVersion: string; notes?: string }) =>
    api.post('/api/security/rotate-keys', payload),
  getHealth: () => api.get<HealthResponse>('/api/health'),
}
