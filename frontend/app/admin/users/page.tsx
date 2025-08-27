'use client'

import React, { useEffect, useState } from 'react'
import AdminLayout from '../../../components/AdminLayout'
import {
  Search,
  Filter,
  User,
  Ban,
  CheckCircle,
  AlertTriangle,
  Mail,
  Calendar,
  MoreHorizontal,
  Shield,
  ShieldOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  role: string
  banned: boolean
  banned_reason: string | null
  banned_at: string | null
  total_escrows: number
  last_activity: string | null
}

interface UserFilters {
  search: string
  status: 'all' | 'active' | 'banned'
  role: 'all' | 'user' | 'admin'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    status: 'all',
    role: 'all'
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [filters, pagination.page])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: filters.search,
        status: filters.status,
        role: filters.role
      })

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setUsers(data.users || [])
      setPagination(data.pagination || pagination)

    } catch (err: any) {
      console.error('Users fetch error:', err)
      setError(err.message || 'Failed to load users')
      // Set empty users array as fallback
      setUsers([])
      setPagination({
        page: 1,
        limit: 50,
        total: 0,
        pages: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUserAction = async (userId: string, action: 'ban' | 'unban', reason?: string) => {
    if (action === 'ban' && !reason) {
      reason = prompt('Enter ban reason:') || undefined
      if (!reason) return
    }

    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    setActionLoading(userId)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ action, reason })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updatedUser = await res.json()

      setUsers(users.map(u => u.id === userId ? updatedUser.user : u))
      alert(`User ${action}ned successfully`)

    } catch (err: any) {
      console.error('User action error:', err)
      alert(`Failed to ${action} user: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(user => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      if (!user.username.toLowerCase().includes(searchLower) &&
          !user.display_name?.toLowerCase().includes(searchLower) &&
          !user.id.includes(searchLower)) {
        return false
      }
    }
    if (filters.status !== 'all') {
      if (filters.status === 'banned' && !user.banned) return false
      if (filters.status === 'active' && user.banned) return false
    }
    if (filters.role !== 'all' && user.role !== filters.role) return false
    return true
  })

  const UserCard = ({ user }: { user: User }) => (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div>
            <h3 className="font-medium text-white">{user.display_name || user.username}</h3>
            <p className="text-sm text-gray-400">@{user.username}</p>
            <p className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {user.role === 'admin' && <Shield className="w-4 h-4 text-blue-400" />}
          {user.banned && <Ban className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Joined:</span>
          <span className="ml-2 text-white font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
        </div>
        <div>
          <span className="text-gray-400">Escrows:</span>
          <span className="ml-2 text-white font-medium">{user.total_escrows}</span>
        </div>
        {user.last_activity && (
          <div className="col-span-2">
            <span className="text-gray-400">Last Activity:</span>
            <span className="ml-2 text-white font-medium">{new Date(user.last_activity).toLocaleString()}</span>
          </div>
        )}
        {user.banned && user.banned_reason && (
          <div className="col-span-2">
            <span className="text-red-400">Banned:</span>
            <span className="ml-2 text-red-300">{user.banned_reason}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          user.banned
            ? 'bg-red-500/20 text-red-300 border border-red-400/30'
            : user.role === 'admin'
            ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
            : 'bg-green-500/20 text-green-300 border border-green-400/30'
        }`}>
          {user.banned ? 'Banned' : user.role === 'admin' ? 'Admin' : 'Active'}
        </span>

        <div className="flex space-x-2">
          {user.banned ? (
            <button
              onClick={() => handleUserAction(user.id, 'unban')}
              disabled={actionLoading === user.id}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30 hover:border-green-400/50 px-3 py-1 rounded text-xs flex items-center space-x-1 disabled:opacity-50"
            >
              <CheckCircle className="w-3 h-3" />
              <span>{actionLoading === user.id ? '...' : 'Unban'}</span>
            </button>
          ) : (
            <button
              onClick={() => handleUserAction(user.id, 'ban')}
              disabled={actionLoading === user.id || user.role === 'admin'}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 hover:border-red-400/50 px-3 py-1 rounded text-xs flex items-center space-x-1 disabled:opacity-50"
            >
              <Ban className="w-3 h-3" />
              <span>{actionLoading === user.id ? '...' : 'Ban'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (loading && users.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3 text-white">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg">Loading users...</span>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-gray-400">Manage users, view profiles, and handle moderation</p>
          </div>
          <button
            onClick={fetchUsers}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/10 border border-red-400/30 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
              <h3 className="text-sm font-medium text-red-400">Error</h3>
            </div>
            <p className="mt-2 text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  placeholder="Username, display name, or ID"
                  className="pl-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value as any})}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({...filters, role: e.target.value as any})}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchUsers}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-md flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <User className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-gray-400">Total Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => !u.banned).length}</p>
                <p className="text-sm text-gray-400">Active Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <Ban className="h-8 w-8 text-red-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.banned).length}</p>
                <p className="text-sm text-gray-400">Banned Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-purple-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.role === 'admin').length}</p>
                <p className="text-sm text-gray-400">Admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredUsers.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination({...pagination, page: pagination.page - 1})}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-300">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination({...pagination, page: pagination.page + 1})}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 border border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && users.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
              <span className="text-white">Loading users...</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}