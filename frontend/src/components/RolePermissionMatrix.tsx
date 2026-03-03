import React, { useState } from 'react'
import { rolesAPI } from '@/lib/api'
import { X } from 'lucide-react'

interface Role {
  id: string
  name: string
  description?: string
  permissions?: string[]
  isBuiltIn: boolean
}

interface RolePermissionMatrixProps {
  role: Role
  onClose: () => void
}

const PERMISSION_CATEGORIES = {
  products: {
    label: 'Products',
    permissions: ['create', 'read', 'update', 'delete'],
  },
  sales: {
    label: 'Sales',
    permissions: ['create', 'read', 'update', 'void', 'refund', 'return'],
  },
  inventory: {
    label: 'Inventory',
    permissions: ['read', 'update', 'adjust', 'transfer', 'recount'],
  },
  purchases: {
    label: 'Purchases',
    permissions: ['create', 'read', 'update', 'receive', 'cancel'],
  },
  reports: {
    label: 'Reports',
    permissions: ['view', 'export'],
  },
  users: {
    label: 'Users',
    permissions: ['create', 'read', 'update', 'delete', 'change-password', 'reset-password', 'unlock'],
  },
  roles: {
    label: 'Roles',
    permissions: ['create', 'read', 'update', 'delete'],
  },
  audit: {
    label: 'Audit',
    permissions: ['view'],
  },
}

export default function RolePermissionMatrix({ role, onClose }: RolePermissionMatrixProps) {
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(role.permissions || [])
  )
  const [loading, setLoading] = useState(false)

  const togglePermission = (permission: string) => {
    const newPermissions = new Set(permissions)
    if (newPermissions.has(permission)) {
      newPermissions.delete(permission)
    } else {
      newPermissions.add(permission)
    }
    setPermissions(newPermissions)
  }

  const toggleCategory = (category: string) => {
    const categoryPerms = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]
    const newPermissions = new Set(permissions)
    const allChecked = categoryPerms.permissions.every((perm) =>
      newPermissions.has(`${category}.${perm}`)
    )

    categoryPerms.permissions.forEach((perm) => {
      const fullPerm = `${category}.${perm}`
      if (allChecked) {
        newPermissions.delete(fullPerm)
      } else {
        newPermissions.add(fullPerm)
      }
    })

    setPermissions(newPermissions)
  }

  const handleSave = async () => {
    if (role.isBuiltIn) {
      alert('Cannot modify built-in roles')
      return
    }

    try {
      setLoading(true)
      await rolesAPI.update(role.id, {
        permissions: Array.from(permissions),
      })
      alert('Permissions updated successfully!')
      onClose()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update permissions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6 max-h-96 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">{role.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {role.isBuiltIn ? 'Built-in role (read-only)' : 'Custom role'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 mb-6">
          {Object.entries(PERMISSION_CATEGORIES).map(([category, { label, permissions: categoryPerms }]) => {
            const allChecked = categoryPerms.every((perm) =>
              permissions.has(`${category}.${perm}`)
            )

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleCategory(category)}
                    disabled={role.isBuiltIn || loading}
                    className="rounded"
                  />
                  <label className="font-semibold">{label}</label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 ml-6">
                  {categoryPerms.map((perm) => {
                    const fullPerm = `${category}.${perm}`
                    const isChecked = permissions.has(fullPerm)

                    return (
                      <div key={fullPerm} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(fullPerm)}
                          disabled={role.isBuiltIn || loading}
                          className="rounded"
                        />
                        <label className="text-sm capitalize">{perm}</label>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {role.isBuiltIn && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4 text-sm text-blue-700">
            Built-in roles cannot be modified. Create a custom role to set custom permissions.
          </div>
        )}

        <div className="flex gap-2 border-t pt-4">
          <button
            onClick={handleSave}
            disabled={role.isBuiltIn || loading}
            className="flex-1 bg-primary text-white py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-muted text-foreground py-2 rounded-md text-sm font-medium hover:bg-muted/80"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
