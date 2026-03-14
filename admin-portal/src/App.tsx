import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { backupAll, backupOrg, deprovisionOrg, getOrgHealth, getOrgSettings, listOrgs, login, provisionOrg, restartOrg, updateOrgSettings, verifyMfa } from './api'
import { clearToken, getToken, setToken } from './auth'
import type { DockerSummary, OrgSummary } from './types'

type LoginStage = 'credentials' | 'mfa'

function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState('')
  const [stage, setStage] = useState<LoginStage>('credentials')
  const [tempToken, setTempToken] = useState('')
  const navigate = useNavigate()

  const onLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const result = await login(username, password)

      if ('token' in result) {
        setToken(result.token)
        navigate('/orgs')
        return
      }

      if (result.mfaRequired && result.tempToken) {
        setTempToken(result.tempToken)
        setStage('mfa')
        return
      }

      setError('Unexpected login response')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onVerify = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const result = await verifyMfa(tempToken, totp)
      setToken(result.token)
      navigate('/orgs')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="app-shell">
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h2 style={{ marginTop: 0 }}>Admin Portal Login</h2>
        {stage === 'credentials' ? (
          <form onSubmit={onLogin}>
            <p>Sign in with portal credentials.</p>
            <p>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" />
            </p>
            <p>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" />
            </p>
            <button className="primary" type="submit">Sign In</button>
          </form>
        ) : (
          <form onSubmit={onVerify}>
            <p>Enter 6-digit authenticator code.</p>
            <p>
              <input
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
              />
            </p>
            <div className="row">
              <button className="primary" type="submit">Verify</button>
              <button type="button" onClick={() => setStage('credentials')}>Back</button>
            </div>
          </form>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  )
}

function HealthPanel({ health }: { health: DockerSummary | null }): JSX.Element {
  if (!health) {
    return <p>Loading health...</p>
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Health</h3>
      <p>
        <span className="badge ok">Running: {health.running}</span>{' '}
        <span className="badge ok">Healthy: {health.healthy}</span>{' '}
        <span className={health.unhealthy > 0 ? 'badge bad' : 'badge'}>Unhealthy: {health.unhealthy}</span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>State</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {health.services.map((service, index) => (
            <tr key={index}>
              <td>{String(service.Service || service.Name || '-')}</td>
              <td>{String(service.State || '-')}</td>
              <td>{String(service.Health || '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SettingsPanel({ org }: { org: string }): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [msg, setMsg] = useState('')
  const editable = useMemo(() => {
    const current = settings || {}
    return {
      TRAEFIK_HOST: current.TRAEFIK_HOST || '',
      SMTP_HOST: current.SMTP_HOST || '',
      SMTP_USER: current.SMTP_USER || '',
      SMTP_PASS: current.SMTP_PASS || '',
      SMTP_FROM: current.SMTP_FROM || '',
      TENANT_IDLE_TIMEOUT_MINUTES: current.TENANT_IDLE_TIMEOUT_MINUTES || current.IDLE_TIMEOUT_MINUTES || '',
    }
  }, [settings])

  useEffect(() => {
    getOrgSettings(org)
      .then((data) => setSettings(data.settings))
      .catch((err) => setMsg((err as Error).message))
  }, [org])

  const onChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }))
  }

  const save = async () => {
    try {
      setMsg('')
      const payload = {
        TRAEFIK_HOST: editable.TRAEFIK_HOST,
        SMTP_HOST: editable.SMTP_HOST,
        SMTP_USER: editable.SMTP_USER,
        SMTP_PASS: editable.SMTP_PASS,
        SMTP_FROM: editable.SMTP_FROM,
        TENANT_IDLE_TIMEOUT_MINUTES: editable.TENANT_IDLE_TIMEOUT_MINUTES,
      }
      const result = await updateOrgSettings(org, payload)
      setSettings(result.settings)
      setMsg('Settings updated')
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Org Settings</h3>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>TRAEFIK_HOST</label>
          <input value={editable.TRAEFIK_HOST} onChange={(e) => onChange('TRAEFIK_HOST', e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>SMTP_HOST</label>
          <input value={editable.SMTP_HOST} onChange={(e) => onChange('SMTP_HOST', e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>SMTP_USER</label>
          <input value={editable.SMTP_USER} onChange={(e) => onChange('SMTP_USER', e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>SMTP_PASS</label>
          <input value={editable.SMTP_PASS} onChange={(e) => onChange('SMTP_PASS', e.target.value)} type="password" />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>SMTP_FROM</label>
          <input value={editable.SMTP_FROM} onChange={(e) => onChange('SMTP_FROM', e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>TENANT_IDLE_TIMEOUT_MINUTES</label>
          <input value={editable.TENANT_IDLE_TIMEOUT_MINUTES} onChange={(e) => onChange('TENANT_IDLE_TIMEOUT_MINUTES', e.target.value)} />
        </div>
      </div>
      <p>
        <button className="primary" onClick={save}>Save Settings</button>
      </p>
      {msg ? <p>{msg}</p> : null}
    </div>
  )
}

function ProvisionDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }): JSX.Element {
  const [form, setForm] = useState({
    orgName: '',
    traefikHost: '',
    adminEmail: '',
    adminPassword: '',
    smtpHost: '',
    smtpUser: '',
    smtpPass: '',
  })
  const [msg, setMsg] = useState('')

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(form.adminEmail.trim())) {
      setMsg('POS Admin Email must be a valid email address.')
      return
    }

    if (form.adminPassword.length < 8) {
      setMsg('POS Admin Password must be at least 8 characters.')
      return
    }

    try {
      setMsg('')
      await provisionOrg(form)
      setMsg('Provision request completed.')
      onDone()
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  return (
    <div className="modal">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Provision Organization</h3>
        <form onSubmit={submit}>
          <div className="row">
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="orgName" value={form.orgName} onChange={(e) => set('orgName', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="traefikHost" value={form.traefikHost} onChange={(e) => set('traefikHost', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="POS Admin Email" type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="POS Admin Password" type="password" minLength={8} value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="smtpHost" value={form.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="smtpUser" value={form.smtpUser} onChange={(e) => set('smtpUser', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 200 }}><input placeholder="smtpPass" type="password" value={form.smtpPass} onChange={(e) => set('smtpPass', e.target.value)} /></div>
          </div>
          <p className="row">
            <button className="primary" type="submit">Provision</button>
            <button type="button" onClick={onClose}>Close</button>
          </p>
          {msg ? <p>{msg}</p> : null}
        </form>
      </div>
    </div>
  )
}

function OrgDetailPage(): JSX.Element {
  const [params] = useSearchParams()
  const org = params.get('org') || ''
  const [health, setHealth] = useState<DockerSummary | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!org) {
      return
    }
    getOrgHealth(org)
      .then((data) => setHealth(data.docker))
      .catch((err) => setMsg((err as Error).message))
  }, [org])

  const run = async (fn: () => Promise<{ message: string }>) => {
    try {
      setMsg('')
      const res = await fn()
      setMsg(res.message)
      const data = await getOrgHealth(org)
      setHealth(data.docker)
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  if (!org) {
    return <Navigate to="/orgs" replace />
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Organization: {org}</h2>
        <a href="/orgs">Back</a>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => run(() => restartOrg(org))}>Restart backend/frontend</button>
        <button onClick={() => run(() => backupOrg(org))}>Backup org</button>
      </div>
      <HealthPanel health={health} />
      <div style={{ height: 12 }} />
      <SettingsPanel org={org} />
      {msg ? <p>{msg}</p> : null}
    </div>
  )
}

function OrgsPage(): JSX.Element {
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [error, setError] = useState('')
  const [showProvision, setShowProvision] = useState(false)
  const [confirmOrg, setConfirmOrg] = useState('')
  const navigate = useNavigate()

  const load = async () => {
    try {
      setError('')
      const data = await listOrgs()
      setOrgs(data.orgs)
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      if (message.toLowerCase().includes('token')) {
        clearToken()
        navigate('/login')
      }
    }
  }

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const triggerDeprovision = async () => {
    if (!confirmOrg) {
      return
    }
    try {
      await deprovisionOrg(confirmOrg)
      setConfirmOrg('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const doBackupAll = async () => {
    try {
      await backupAll()
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Organization Management</h2>
        <div className="row">
          <button onClick={() => setShowProvision(true)}>Provision Org</button>
          <button onClick={doBackupAll}>Backup All</button>
          <button
            onClick={() => {
              clearToken()
              navigate('/login')
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Org</th>
              <th>Host</th>
              <th>Health</th>
              <th>Created</th>
              <th>Last backup</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.name}>
                <td>{org.name}</td>
                <td>{org.env.TRAEFIK_HOST || '-'}</td>
                <td>
                  {org.docker.unhealthy > 0 ? (
                    <span className="badge bad">Issues</span>
                  ) : (
                    <span className="badge ok">Healthy</span>
                  )}
                </td>
                <td>{new Date(org.createdAt).toLocaleString()}</td>
                <td>{org.lastBackup ? new Date(org.lastBackup).toLocaleString() : '-'}</td>
                <td>
                  <div className="row">
                    <button onClick={() => navigate(`/org-detail?org=${encodeURIComponent(org.name)}`)}>View</button>
                    <button className="danger" onClick={() => setConfirmOrg(org.name)}>Deprovision</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {showProvision ? <ProvisionDialog onClose={() => setShowProvision(false)} onDone={load} /> : null}

      {confirmOrg ? (
        <div className="modal">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Confirm Deprovision</h3>
            <p>This will remove containers, volumes, and org directory for: <strong>{confirmOrg}</strong></p>
            <div className="row">
              <button className="danger" onClick={triggerDeprovision}>Confirm</button>
              <button onClick={() => setConfirmOrg('')}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function App(): JSX.Element {
  const authed = Boolean(getToken())

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/orgs" element={authed ? <OrgsPage /> : <Navigate to="/login" replace />} />
      <Route path="/org-detail" element={authed ? <OrgDetailPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={authed ? '/orgs' : '/login'} replace />} />
    </Routes>
  )
}
