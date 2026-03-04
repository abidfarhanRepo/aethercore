import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'

interface UserSettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
}

const ROLES = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOCK_CLERK']

export default function UserSettings({ settings, onSave }: UserSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultUserRole, setDefaultUserRole] = useState('CASHIER')
  const [requirePasswordChange, setRequirePasswordChange] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('30')

  useEffect(() => {
    const loadInitialValues = () => {
      const roleSetting = settings.find((s) => s.key === 'default_user_role')
      const passwordSetting = settings.find((s) => s.key === 'require_password_change_first_login')
      const timeoutSetting = settings.find((s) => s.key === 'session_timeout_minutes')

      if (roleSetting) setDefaultUserRole(roleSetting.value)
      if (passwordSetting) setRequirePasswordChange(passwordSetting.value === 'true')
      if (timeoutSetting) setSessionTimeout(timeoutSetting.value)
    }

    loadInitialValues()
  }, [settings])

  const handleSaveDefaultRole = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSave('default_user_role', defaultUserRole)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePasswordChange = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSave('require_password_change_first_login', requirePasswordChange)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSessionTimeout = async () => {
    const timeout = Number(sessionTimeout)
    if (isNaN(timeout) || timeout < 1) {
      setError('Session timeout must be at least 1 minute')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('session_timeout_minutes', timeout)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      ADMIN: 'Full system access - all features and configurations',
      MANAGER: 'Manager access - reports, user management, refunds',
      SUPERVISOR: 'Supervisor access - view reports and audit logs',
      CASHIER: 'Cashier access - POS and basic operations',
      STOCK_CLERK: 'Inventory access - stock management and counts',
    }
    return descriptions[role] || ''
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Default User Role */}
      <Card>
        <CardHeader>
          <CardTitle>Default User Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            New employees will be assigned this role by default
          </p>
          <div className="space-y-3">
            {ROLES.map((role) => (
              <label key={role} className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="radio"
                  name="defaultRole"
                  value={role}
                  checked={defaultUserRole === role}
                  onChange={(e) => setDefaultUserRole(e.target.value)}
                  disabled={loading}
                  className="h-4 w-4 mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{role}</p>
                  <p className="text-xs text-muted-foreground">{getRoleDescription(role)}</p>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={handleSaveDefaultRole} disabled={loading}>
            Save Default Role
          </Button>
        </CardContent>
      </Card>

      {/* Password Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Password Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Security settings for new user accounts
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <button
                onClick={() => setRequirePasswordChange(!requirePasswordChange)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition flex-shrink-0 ${
                  requirePasswordChange ? 'bg-green-600' : 'bg-gray-300'
                }`}
                disabled={loading}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                    requirePasswordChange ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <div className="flex-1">
                <p className="font-medium text-sm">Force Password Change on First Login</p>
                <p className="text-xs text-muted-foreground">
                  New users must change their temporary password before first use
                </p>
                <Button onClick={handleSavePasswordChange} disabled={loading} className="mt-2" size="sm">
                  Save
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle>Session Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Session Timeout</label>
            <p className="text-xs text-muted-foreground">
              Automatic logout after this many minutes of inactivity
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  type="number"
                  min="1"
                  max="480"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  placeholder="30"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 15-60 minutes
                </p>
              </div>
              <Button onClick={handleSaveSessionTimeout} disabled={loading}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Role-Based Access Control</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            🔐 <strong>RBAC Enabled:</strong> All users have role-based permissions that control
            what features they can access
          </p>
          <p>
            👨‍💼 <strong>Manager Review:</strong> Managers can view and manage users under their
            authority
          </p>
          <p>
            📋 <strong>Audit Trails:</strong> All user actions are logged for compliance and
            security
          </p>
        </CardContent>
      </Card>

      {/* Current Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Default User Role</span>
              <span className="text-sm font-semibold text-primary">{defaultUserRole}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Force Password Change</span>
              <span className={`text-sm font-semibold ${requirePasswordChange ? 'text-green-600' : 'text-gray-600'}`}>
                {requirePasswordChange ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Session Timeout</span>
              <span className="text-sm font-semibold">{sessionTimeout} minutes</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
