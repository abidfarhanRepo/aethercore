import React, { useEffect, useState } from 'react'
import { usersAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Plus, Edit2, Trash2, Lock, Search } from 'lucide-react'
import CreateUserModal from '@/components/CreateUserModal'
import EditUserModal from '@/components/EditUserModal'

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
  createdAt: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'lastLogin'>('name')

  useEffect(() => {
    fetchUsers()
  }, [search, roleFilter, departmentFilter])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await usersAPI.list({
        search: search || undefined,
        role: roleFilter || undefined,
        department: departmentFilter || undefined,
      })
      setUsers(response.data.users)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return

    try {
      await usersAPI.delete(userId)
      fetchUsers()
    } catch (error) {
      console.error('Failed to deactivate user:', error)
      alert('Failed to deactivate user')
    }
  }

  const handleUserCreated = () => {
    setShowCreateModal(false)
    fetchUsers()
  }

  const handleUserUpdated = () => {
    setEditingUser(null)
    fetchUsers()
  }

  const handleResetMfa = async (user: User) => {
    if (!confirm(`Reset MFA for ${user.email}? They will need to re-enroll.`)) return

    try {
      await usersAPI.resetMfa(user.id)
      alert('MFA reset successfully')
      fetchUsers()
    } catch (error) {
      console.error('Failed to reset MFA:', error)
      alert('Failed to reset MFA')
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.firstName} ${a.lastName}`.trim()
      const nameB = `${b.firstName} ${b.lastName}`.trim()
      return nameA.localeCompare(nameB)
    } else if (sortBy === 'role') {
      return a.role.localeCompare(b.role)
    } else if (sortBy === 'lastLogin') {
      return new Date(b.lastLogin || 0).getTime() - new Date(a.lastLogin || 0).getTime()
    }
    return 0
  })

  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center h-screen">Loading users...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 border border-border rounded-md w-full text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-md w-full text-sm"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="CASHIER">Cashier</option>
            <option value="STOCK_CLERK">Stock Clerk</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Department</label>
          <input
            type="text"
            placeholder="Filter by department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-md w-full text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-md w-full text-sm"
          >
            <option value="name">Name</option>
            <option value="role">Role</option>
            <option value="lastLogin">Last Login</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Department</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Last Login</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</td>
                <td className="px-6 py-4 text-sm">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{user.department || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => handleResetMfa(user)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                  >
                    <Lock className="h-3 w-3" />
                    Reset MFA
                  </button>
                  <button
                    onClick={() => setEditingUser(user)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No users found. Try adjusting your filters.
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onUserCreated={handleUserCreated}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </div>
  )
}
