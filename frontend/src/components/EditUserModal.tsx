import React, { useState, useEffect } from 'react'
import { usersAPI } from '@/lib/api'
import { X, Lock } from 'lucide-react'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  role: string
  department?: string
  isActive: boolean
  lastLogin?: string
}

interface EditUserModalProps {
  user: User
  onClose: () => void
  onUserUpdated: () => void
}

export default function EditUserModal({ user, onClose, onUserUpdated }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    phone: user.phone || '',
    role: user.role,
    department: user.department || '',
    isActive: user.isActive,
  })

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (showActivityLog) {
      fetchActivityLog()
    }
  }, [showActivityLog])

  const fetchActivityLog = async () => {
    try {
      const response = await usersAPI.getAuditLog(user.id, 20)
      setActivityLogs(response.data.logs)
    } catch (error) {
      console.error('Failed to fetch activity log:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.firstName) newErrors.firstName = 'First name is required'
    if (!formData.lastName) newErrors.lastName = 'Last name is required'

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    try {
      setLoading(true)
      await usersAPI.update(user.id, formData)
      onUserUpdated()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update user'
      setErrors({ submit: message })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!passwordData.currentPassword) newErrors.currentPassword = 'Current password is required'
    if (!passwordData.newPassword) newErrors.newPassword = 'New password is required'
    if (passwordData.newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters'
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    try {
      setLoading(true)
      await usersAPI.changePassword(user.id, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })
      setShowPasswordChange(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      alert('Password changed successfully!')
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to change password'
      setErrors({ passwordSubmit: message })
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async () => {
    if (!confirm('Are you sure you want to unlock this account?')) return

    try {
      setLoading(true)
      await usersAPI.unlock(user.id)
      alert('Account unlocked successfully!')
      onUserUpdated()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to unlock account'
      setErrors({ submit: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-96 overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit User</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {errors.submit}
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  disabled={loading}
                />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  disabled={loading}
                />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email (read-only)</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                disabled={loading}
              >
                <option value="ADMIN">Admin - Full access</option>
                <option value="MANAGER">Manager - Manage users & reports</option>
                <option value="SUPERVISOR">Supervisor - View reports only</option>
                <option value="CASHIER">Cashier - Checkout only</option>
                <option value="STOCK_CLERK">Stock Clerk - Inventory only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={loading}
              />
              <label className="text-sm">Active</label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-muted text-foreground py-2 rounded-md text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Action Buttons */}
          <div className="border-t pt-4 space-y-2">
            <button
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="w-full px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted"
              disabled={loading}
            >
              {showPasswordChange ? 'Cancel' : 'Change Password'}
            </button>

            {showPasswordChange && (
              <form onSubmit={handlePasswordChange} className="space-y-2 bg-muted p-3 rounded">
                {errors.passwordSubmit && (
                  <div className="bg-red-50 text-red-700 p-2 rounded text-xs">
                    {errors.passwordSubmit}
                  </div>
                )}
                <input
                  type="password"
                  placeholder="Current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-2 py-1 border border-border rounded text-sm"
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-2 py-1 border border-border rounded text-sm"
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-2 py-1 border border-border rounded text-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white py-1 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            <button
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="w-full px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted"
              disabled={loading}
            >
              {showActivityLog ? 'Hide' : 'View'} Activity Log
            </button>

            <button
              onClick={handleUnlock}
              className="w-full px-3 py-2 text-sm font-medium border border-yellow-500 text-yellow-700 rounded-md hover:bg-yellow-50 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <Lock className="h-4 w-4" />
              Unlock Account
            </button>
          </div>

          {/* Activity Log */}
          {showActivityLog && (
            <div className="border-t pt-4 space-y-2 max-h-48 overflow-auto">
              <h3 className="font-semibold text-sm">Recent Activity</h3>
              {activityLogs.length > 0 ? (
                activityLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="text-xs bg-muted p-2 rounded">
                    <p className="font-medium">{log.action}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {log.details && <p className="text-muted-foreground text-xs">{log.details}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No activity</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
