import React, { useEffect, useState } from 'react'
import { rolesAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import RolePermissionMatrix from '@/components/RolePermissionMatrix'

interface Role {
  id: string
  name: string
  description?: string
  permissions?: string[]
  userCount: number
  isBuiltIn: boolean
  createdAt: string
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showMatrix, setShowMatrix] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  })

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const response = await rolesAPI.list({ limit: 100 })
      setRoles(response.data.roles)
    } catch (error) {
      console.error('Failed to fetch roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      alert('Role name is required')
      return
    }

    try {
      await rolesAPI.create({
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions,
      })
      setNewRole({ name: '', description: '', permissions: [] })
      setShowCreateForm(false)
      fetchRoles()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create role')
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return

    try {
      await rolesAPI.delete(roleId)
      fetchRoles()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete role')
    }
  }

  if (loading && roles.length === 0) {
    return <div className="flex items-center justify-center h-screen">Loading roles...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Role Management</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="border border-border rounded-lg p-6 space-y-4 bg-muted/30">
          <h2 className="font-semibold">New Custom Role</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Role Name</label>
            <input
              type="text"
              placeholder="e.g., Store Lead"
              value={newRole.name}
              onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              placeholder="What does this role do?"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm h-20"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateRole}
              className="flex-1 bg-primary text-white py-2 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Create Role
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="flex-1 bg-muted text-foreground py-2 rounded-md text-sm font-medium hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="border border-border rounded-lg p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-lg">{role.name}</h3>
                {role.isBuiltIn && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    Built-in
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{role.description || '-'}</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{role.userCount} {role.userCount === 1 ? 'user' : 'users'}</span>
            </div>

            {role.permissions && role.permissions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 5).map((perm) => (
                    <span key={perm} className="text-xs px-2 py-1 rounded bg-muted">
                      {perm.split('.')[1]}
                    </span>
                  ))}
                  {role.permissions.length > 5 && (
                    <span className="text-xs px-2 py-1 rounded bg-muted">
                      +{role.permissions.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => {
                  setSelectedRole(role)
                  setShowMatrix(true)
                }}
                className="flex-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <Edit2 className="h-3 w-3 inline mr-1" />
                Permissions
              </button>

              {!role.isBuiltIn && (
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  className="flex-1 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  <Trash2 className="h-3 w-3 inline mr-1" />
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Permission Matrix Modal */}
      {showMatrix && selectedRole && (
        <RolePermissionMatrix
          role={selectedRole}
          onClose={() => {
            setShowMatrix(false)
            setSelectedRole(null)
            fetchRoles()
          }}
        />
      )}
    </div>
  )
}
