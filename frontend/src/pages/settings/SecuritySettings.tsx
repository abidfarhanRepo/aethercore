import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BellRing, CheckCircle2, KeyRound, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/lib/auth'
import { notificationAPI, AppNotification } from '@/lib/notificationAPI'
import {
  securityAPI,
  SecurityEventItem,
  KeyRotationItem,
  SecurityStatusResponse,
  HealthResponse,
  AlertRulesConfig,
  AlertRuleType,
  AlertEvaluationResult,
} from '@/lib/securityAPI'

const COMPONENT_OPTIONS: Array<{ value: 'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings'; label: string }> = [
  { value: 'jwt_access', label: 'JWT Access Secret' },
  { value: 'jwt_refresh', label: 'JWT Refresh Secret' },
  { value: 'encryption', label: 'Encryption Key' },
  { value: 'tls', label: 'TLS Certificate/Key' },
  { value: 'settings', label: 'Sensitive Settings Bucket' },
]

const badgeBySeverity: Record<string, string> = {
  LOW: 'bg-blue-50 text-blue-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-orange-50 text-orange-800',
  CRITICAL: 'bg-red-50 text-red-700',
}

const ALERT_RULE_LABELS: Record<AlertRuleType, string> = {
  auth_spike: 'Auth Spike',
  security_status_failure: 'Security Status Failure',
  cert_expiry: 'Certificate Expiry (days)',
  backup_failure: 'Backup Failure',
}

export default function SecuritySettings() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [securityStatus, setSecurityStatus] = useState<SecurityStatusResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [events, setEvents] = useState<SecurityEventItem[]>([])
  const [rotations, setRotations] = useState<KeyRotationItem[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [component, setComponent] = useState<'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings'>('jwt_access')
  const [newVersion, setNewVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [rotationMessage, setRotationMessage] = useState<string | null>(null)
  const [alertRules, setAlertRules] = useState<AlertRulesConfig | null>(null)
  const [alertsMessage, setAlertsMessage] = useState<string | null>(null)
  const [alertEvaluation, setAlertEvaluation] = useState<AlertEvaluationResult | null>(null)
  const [savingAlerts, setSavingAlerts] = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isOpsReader = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [statusRes, healthRes, eventsRes, rotationsRes, notificationsRes, unreadRes] = await Promise.all([
        securityAPI.getStatus(),
        securityAPI.getHealth(),
        securityAPI.getEvents(30),
        securityAPI.getKeyRotations(30),
        notificationAPI.list({ includeArchived: true, limit: 100 }),
        notificationAPI.getUnreadCount(),
      ])

      setSecurityStatus(statusRes.data)
      setHealth(healthRes.data)
      setEvents(eventsRes.data.items)
      setRotations(rotationsRes.data.items)
      setNotifications(notificationsRes.data.notifications)
      setUnreadCount(unreadRes.data.unreadCount)

      if (isOpsReader) {
        const alertsRes = await securityAPI.getAlertRules()
        setAlertRules(alertsRes.data.config)
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load security data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const runRotation = async () => {
    if (!newVersion.trim()) {
      setError('New version is required for key rotation logging.')
      return
    }

    try {
      setError(null)
      setRotationMessage(null)
      const response = await securityAPI.rotateKeys({
        component,
        newVersion: newVersion.trim(),
        notes: notes.trim() || undefined,
      })
      setRotationMessage(response.data?.message || 'Rotation logged successfully.')
      setNewVersion('')
      setNotes('')
      await loadData()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Rotation logging failed')
    }
  }

  const updateRuleField = (rule: AlertRuleType, field: 'enabled' | 'threshold' | 'windowMinutes', value: boolean | number) => {
    setAlertRules((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rules: {
          ...prev.rules,
          [rule]: {
            ...prev.rules[rule],
            [field]: value,
          },
        },
      }
    })
  }

  const saveAlertRules = async () => {
    if (!alertRules || !isAdmin) return

    try {
      setSavingAlerts(true)
      setError(null)
      setAlertsMessage(null)
      const response = await securityAPI.updateAlertRules(alertRules)
      setAlertRules(response.data.config)
      setAlertsMessage('Alert rules updated.')
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update alert rules')
    } finally {
      setSavingAlerts(false)
    }
  }

  const evaluateAlerts = async () => {
    if (!isOpsReader) return

    try {
      setError(null)
      const response = await securityAPI.evaluateAlertRules()
      setAlertEvaluation(response.data.evaluation)
      setAlertsMessage(
        response.data.evaluation.triggered.length > 0
          ? `${response.data.evaluation.triggered.length} alert(s) triggered.`
          : 'Alert evaluation completed with no triggers.'
      )
      await loadData()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to evaluate alert rules')
    }
  }

  const securityNotifications = useMemo(
    () => notifications.filter((n) => n.type === 'SECURITY' || n.type === 'AUTH'),
    [notifications]
  )

  const markRead = async (id: string) => {
    await notificationAPI.markRead(id)
    await loadData()
  }

  const archive = async (id: string) => {
    await notificationAPI.archive(id)
    await loadData()
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {rotationMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <p className="text-sm text-green-700">{rotationMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {securityStatus?.https.enforced ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldX className="h-4 w-4 text-red-600" />}
              HTTPS Enforcement
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Status: <strong>{securityStatus?.https.enforced ? 'Enforced' : 'Not Enforced'}</strong></p>
            <p>Source: <code>{securityStatus?.https.source || 'unknown'}</code></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">TLS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Cert Path: <strong>{securityStatus?.tls.certPath.configured ? 'Configured' : 'Missing'}</strong></p>
            <p>Key Path: <strong>{securityStatus?.tls.keyPath.configured ? 'Configured' : 'Missing'}</strong></p>
            <p>CA Path: <strong>{securityStatus?.tls.caPath.configured ? 'Configured' : 'Missing'}</strong></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Health Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>System: <strong>{health?.status || 'unknown'}</strong></p>
            <p>DB: <strong>{health?.checks.database.ok ? 'OK' : 'Down'}</strong></p>
            <p>Redis: <strong>{health?.checks.redis.ok ? 'OK' : 'Down'}</strong></p>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Key Rotation Workflow (Audit + Notification)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                value={component}
                onChange={(e) => setComponent(e.target.value as 'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings')}
              >
                {COMPONENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="New version (e.g. 2026-Q2-v1)"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={runRotation}>Log Rotation</Button>
              <p className="text-xs text-muted-foreground">
                Logging a rotation does not hot-swap process secrets. Update secret provider values and redeploy services.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isOpsReader && alertRules && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">P8-B Alert Rules and Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(alertRules.rules) as AlertRuleType[]).map((rule) => (
                <div key={rule} className="border border-border rounded-md p-3 space-y-2">
                  <p className="text-sm font-medium">{ALERT_RULE_LABELS[rule]}</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alertRules.rules[rule].enabled}
                      disabled={!isAdmin}
                      onChange={(e) => updateRuleField(rule, 'enabled', e.target.checked)}
                    />
                    Enabled
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={alertRules.rules[rule].threshold}
                    disabled={!isAdmin}
                    onChange={(e) => updateRuleField(rule, 'threshold', Number(e.target.value || 1))}
                    placeholder="Threshold"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={alertRules.rules[rule].windowMinutes}
                    disabled={!isAdmin}
                    onChange={(e) => updateRuleField(rule, 'windowMinutes', Number(e.target.value || 1))}
                    placeholder="Window (minutes)"
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={alertRules.routingPolicy.notifyAdminManager}
                disabled={!isAdmin}
                onChange={(e) =>
                  setAlertRules((prev) =>
                    prev
                      ? {
                          ...prev,
                          routingPolicy: {
                            ...prev.routingPolicy,
                            notifyAdminManager: e.target.checked,
                          },
                        }
                      : prev
                  )
                }
              />
              Notify Admin/Manager recipients
            </label>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => void saveAlertRules()} disabled={savingAlerts}>
                  Save Alert Rules
                </Button>
              )}
              <Button variant="outline" onClick={() => void evaluateAlerts()}>
                Evaluate Now
              </Button>
            </div>
            {alertsMessage && <p className="text-sm text-muted-foreground">{alertsMessage}</p>}
            {alertEvaluation && (
              <div className="text-sm text-muted-foreground">
                Last evaluated: {new Date(alertEvaluation.checkedAt).toLocaleString()} ({alertEvaluation.triggered.length} triggered)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notification History ({unreadCount} unread)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityNotifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications found.</p>}
          {securityNotifications.map((item) => (
            <div key={item.id} className="border border-border rounded-md p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${badgeBySeverity[item.severity] || 'bg-slate-50 text-slate-700'}`}>
                  {item.severity}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-muted">{item.type}</span>
                <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="font-medium mt-2">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.message}</p>
              <div className="mt-2 flex gap-2">
                {!item.isRead && <Button variant="outline" onClick={() => void markRead(item.id)}>Mark Read</Button>}
                {!item.isArchived && <Button variant="outline" onClick={() => void archive(item.id)}>Archive</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Security Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {events.length === 0 && <p className="text-sm text-muted-foreground">No events found.</p>}
            {events.map((event) => (
              <div key={event.id} className="p-2 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                <div className="text-sm font-medium">{event.eventType}</div>
                <div className="text-sm">{event.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Key Rotation History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-auto">
            {rotations.length === 0 && <p className="text-sm text-muted-foreground">No rotation records found.</p>}
            {rotations.map((rotation) => (
              <div key={rotation.id} className="p-2 border border-border rounded-md">
                <div className="text-xs text-muted-foreground">{new Date(rotation.rotatedAt).toLocaleString()}</div>
                <div className="text-sm font-medium">{rotation.component}</div>
                <div className="text-xs text-muted-foreground">
                  {rotation.oldKeyVersion || 'n/a'} {'->'} {rotation.newKeyVersion || 'n/a'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          Refresh Security Data
        </Button>
      </div>
    </div>
  )
}
