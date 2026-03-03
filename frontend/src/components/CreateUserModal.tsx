import React, { useState } from 'react'
import { usersAPI } from '@/lib/api'
import { X } from 'lucide-react'

interface CreateUserModalProps {
  onClose: () => void
  onUserCreated: () => void
}

export default function CreateUserModal({ onClose, onUserCreated }: CreateUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'CASHIER',
    department: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validatePassword = (password: string): string[] => {
    const issues = []
    if (password.length < 8) issues.push('Minimum 8 characters')
    if (!/[A-Z]/.test(password)) issues.push('At least 1 uppercase letter')
    if (!/[0-9]/.test(password)) issues.push('At least 1 number')
    if (!/[!@#$%^&*]/.test(password)) issues.push('At least 1 special character (!@#$%^&*)')
    return issues
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email'

    if (!formData.password) newErrors.password = 'Password is required'
    else {
      const issues = validatePassword(formData.password)
      if (issues.length > 0) newErrors.password = issues.join(', ')
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.firstName) newErrors.firstName = 'First name is required'
    if (!formData.lastName) newErrors.lastName = 'Last name is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setLoading(true)
      const { confirmPassword, ...submitData } = formData
      await usersAPI.create(submitData)
      onUserCreated()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create user'
      setErrors({ submit: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-96 overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create New User</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
              disabled={loading}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
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
              placeholder="e.g., Sales, Operations"
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
              disabled={loading}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            {formData.password && !errors.password && (
              <p className="text-green-500 text-xs mt-1">✓ Password meets requirements</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
              disabled={loading}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-white py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
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
      </div>
    </div>
  )
}
