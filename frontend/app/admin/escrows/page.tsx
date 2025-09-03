'use client'

import React, { useEffect, useState } from 'react'
import AdminLayout from '../../../components/AdminLayout'
import {
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  User,
  Calendar,
  MoreHorizontal,
  MessageSquare,
  Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Escrow {
  id: string
  buyer_id: string
  seller_id: string
  amount: number
  currency: string
  payment_method: string
  status: string
  created_at: string
  platform_fee_amount: number
  seed_phrase?: string
  buyer_profile?: {
    username?: string
    display_name?: string
  }
  seller_profile?: {
    username?: string
    display_name?: string
  }
}

interface EscrowFilters {
  status: string
  payment_method: string
  currency: string
  search: string
}

export default function AdminEscrowsPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<EscrowFilters>({
    status: 'all',
    payment_method: 'all',
    currency: 'all',
    search: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchEscrows()
  }, [filters, pagination.page])

  const fetchEscrows = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: filters.status === 'all' ? '' : filters.status,
        payment_method: filters.payment_method === 'all' ? '' : filters.payment_method,
        currency: filters.currency === 'all' ? '' : filters.currency,
        search: filters.search
      })

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/escrows?${params}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          "ngrok-skip-browser-warning": "true"
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setEscrows(data.escrows || [])
      setPagination(data.pagination || pagination)

    } catch (err: any) {
      console.error('Escrows fetch error:', err)
      setError(err.message || 'Failed to load escrows')
    } finally {
      setLoading(false)
    }
  }

  const handleEscrowAction = async (escrowId: string, action: 'cancel' | 'force_release' | 'resolve_dispute' | 'regenerate_wallet', resolution?: string) => {
    if (action === 'resolve_dispute' && !resolution) {
      resolution = prompt('Enter dispute resolution details:') || undefined
      if (!resolution) return
    }

    let toAddress: string | undefined
    if (action === 'force_release' || action === 'cancel') {
      const ask = prompt(`${action === 'force_release' ? 'Optional override release address' : 'Optional cancel refund address'} (leave blank for default):`)
      toAddress = ask ? ask.trim() : undefined
    }

    const actionMessages = {
      cancel: 'cancel this escrow',
      force_release: 'force release funds to seller',
      resolve_dispute: 'resolve this dispute',
      regenerate_wallet: 'regenerate a new wallet and seed phrase for this escrow (advanced)'
    }

    if (!confirm(`Are you sure you want to ${actionMessages[action]}?`)) return

    setActionLoading(escrowId)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/escrows/${escrowId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ action, resolution, to_address: toAddress })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchEscrows()
      alert(`Escrow ${action} completed successfully`)

    } catch (err: any) {
      console.error('Escrow action error:', err)
      alert(`Failed to ${action}: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
      funded: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
      processing: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
      completed: 'bg-green-500/20 text-green-300 border-green-400/30',
      cancelled: 'bg-red-500/20 text-red-300 border-red-400/30',
      dispute_resolved: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-300 border-gray-400/30'
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: Clock,
      funded: DollarSign,
      processing: Shield,
      completed: CheckCircle,
      cancelled: XCircle,
      dispute_resolved: CheckCircle
    }
    return icons[status as keyof typeof icons] || FileText
  }

  const filteredEscrows = escrows.filter(escrow => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const buyerU = escrow.buyer_profile?.username?.toLowerCase() || ''
      const sellerU = escrow.seller_profile?.username?.toLowerCase() || ''
      if (!escrow.id.includes(searchLower) &&
          !buyerU.includes(searchLower) &&
          !sellerU.includes(searchLower)) {
        return false
      }
    }
    if (filters.status !== 'all' && escrow.status !== filters.status) return false
    if (filters.payment_method !== 'all' && escrow.payment_method !== filters.payment_method) return false
    if (filters.currency !== 'all' && escrow.currency !== filters.currency) return false
    return true
  })

  const EscrowCard = ({ escrow }: { escrow: Escrow }) => {
    const StatusIcon = getStatusIcon(escrow.status)
    const availableActions = []
    const [showSeed, setShowSeed] = React.useState(false)

    if (escrow.status === 'funded') {
      availableActions.push('force_release')
    }
    if (['pending', 'funded', 'processing'].includes(escrow.status)) {
      availableActions.push('cancel')
    }
    if (escrow.status === 'disputed') {
      availableActions.push('resolve_dispute')
    }
    // Admin utility: allow wallet regeneration regardless of status
    availableActions.push('regenerate_wallet')

    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <StatusIcon className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-medium text-white">Escrow #{escrow.id.slice(0, 8)}</h3>
              <p className="text-sm text-gray-400">{new Date(escrow.created_at).toLocaleString()}</p>
            </div>
          </div>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(escrow.status)}`}>
            {escrow.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-400">Buyer:</span>
            <div className="flex items-center mt-1">
              <User className="w-4 h-4 text-gray-400 mr-1" />
              <span className="text-white font-medium">{escrow.buyer_profile?.display_name || escrow.buyer_id.slice(0,8)}</span>
              {escrow.buyer_profile?.username && (
                <span className="text-gray-400 ml-1">(@{escrow.buyer_profile.username})</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Seller:</span>
            <div className="flex items-center mt-1">
              <User className="w-4 h-4 text-gray-400 mr-1" />
              <span className="text-white font-medium">{escrow.seller_profile?.display_name || escrow.seller_id.slice(0,8)}</span>
              {escrow.seller_profile?.username && (
                <span className="text-gray-400 ml-1">(@{escrow.seller_profile.username})</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Amount:</span>
            <span className="ml-2 text-white font-medium">
              {escrow.amount} {escrow.currency}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Fee:</span>
            <span className="ml-2 text-white">
              {escrow.platform_fee_amount} {escrow.currency}
            </span>
          </div>
          {escrow.seed_phrase && (
            <div className="col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-400">Seed Phrase:</span>
                  <span className="ml-2 text-white font-mono break-words">
                    {showSeed ? escrow.seed_phrase : '•••• •••• •••• •••• •••• •••• •••• ••••'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSeed(s => !s)}
                    className="px-2 py-1 text-xs rounded border border-orange-400/30 text-orange-300 hover:bg-orange-500/20"
                  >
                    {showSeed ? 'Hide' : 'Reveal'}
                  </button>
                  {showSeed && (
                    <button
                      onClick={() => navigator.clipboard.writeText(escrow.seed_phrase || '')}
                      className="px-2 py-1 text-xs rounded border border-gray-500/40 text-gray-200 hover:bg-white/10"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {escrow.payment_method}
          </span>
          {availableActions.length > 0 && (
            <div className="flex space-x-2">
              {availableActions.includes('force_release') && (
                <button
                  onClick={() => handleEscrowAction(escrow.id, 'force_release')}
                  disabled={actionLoading === escrow.id}
                  className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30 hover:border-green-400/50 px-3 py-1 rounded text-xs disabled:opacity-50"
                >
                  {actionLoading === escrow.id ? '...' : 'Force Release'}
                </button>
              )}
              {availableActions.includes('resolve_dispute') && (
                <button
                  onClick={() => handleEscrowAction(escrow.id, 'resolve_dispute')}
                  disabled={actionLoading === escrow.id}
                  className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 hover:border-indigo-400/50 px-3 py-1 rounded text-xs disabled:opacity-50"
                >
                  {actionLoading === escrow.id ? '...' : 'Resolve'}
                </button>
              )}
              {availableActions.includes('cancel') && (
                <button
                  onClick={() => handleEscrowAction(escrow.id, 'cancel')}
                  disabled={actionLoading === escrow.id}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 hover:border-red-400/50 px-3 py-1 rounded text-xs disabled:opacity-50"
                >
                  {actionLoading === escrow.id ? '...' : 'Cancel'}
                </button>
              )}
              {availableActions.includes('regenerate_wallet') && (
                <button
                  onClick={() => handleEscrowAction(escrow.id, 'regenerate_wallet')}
                  disabled={actionLoading === escrow.id}
                  className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-400/30 hover:border-yellow-400/50 px-3 py-1 rounded text-xs disabled:opacity-50"
                >
                  {actionLoading === escrow.id ? '...' : 'Regenerate Wallet'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading && escrows.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3 text-white">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg">Loading escrows...</span>
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
            <h1 className="text-3xl font-bold text-white">Escrow Management</h1>
            <p className="text-gray-400">Monitor escrows and resolve disputes</p>
          </div>
          <button
            onClick={fetchEscrows}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  placeholder="Escrow ID or username"
                  className="pl-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="funded">Funded</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Payment Method</label>
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters({...filters, payment_method: e.target.value})}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Methods</option>
                <option value="crypto">Crypto</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Currency</label>
              <select
                value={filters.currency}
                onChange={(e) => setFilters({...filters, currency: e.target.value})}
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Currencies</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchEscrows}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-md flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{pagination.total}</p>
                <p className="text-sm text-gray-400">Total Escrows</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{escrows.filter(e => e.status === 'pending').length}</p>
                <p className="text-sm text-gray-400">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{escrows.filter(e => e.status === 'funded').length}</p>
                <p className="text-sm text-gray-400">Funded</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{escrows.filter(e => e.status === 'completed').length}</p>
                <p className="text-sm text-gray-400">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-400 mr-3" />
              <div>
                <p className="text-2xl font-bold text-white">{escrows.filter(e => ['cancelled', 'disputed'].includes(e.status)).length}</p>
                <p className="text-sm text-gray-400">Issues</p>
              </div>
            </div>
          </div>
        </div>

        {/* Escrows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEscrows.map((escrow) => (
            <EscrowCard key={escrow.id} escrow={escrow} />
          ))}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
            <div className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} escrows
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
        {loading && escrows.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
              <span className="text-white">Loading escrows...</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}