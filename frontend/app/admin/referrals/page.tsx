'use client'

import React, { useEffect, useState } from 'react'
import AdminLayout from '../../../components/AdminLayout'
import { AlertTriangle, Users, Link as LinkIcon, DollarSign, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AdminReferralItem {
  id: string
  username: string
  display_name?: string
  referral_payout_address?: string
  referral_payout_currency?: string
  totals: {
    referred_count: number
    accrued_usd: number
    paid_usd: number
    balance_usd: number
  }
}

export default function AdminReferralsPage() {
  const [items, setItems] = useState<AdminReferralItem[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search
      })
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/referrals?${params}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          "ngrok-skip-browser-warning": "true"
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.items || [])
      setPagination(data.pagination || pagination)
    } catch (e: any) {
      setError(e.message || 'Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSummary() }, [pagination.page, search])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Referrals</h1>
            <p className="text-gray-400">Monitor referral performance and payouts</p>
          </div>
          <button
            onClick={fetchSummary}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50/10 border border-red-400/30 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
              <h3 className="text-sm font-medium text-red-400">Error</h3>
            </div>
            <p className="mt-2 text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <LinkIcon className="h-5 w-5 text-blue-400" />
              <span className="text-white font-medium">Referral Addresses & Performance</span>
            </div>
            <input
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Search username"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left py-2 pr-4">User</th>
                  <th className="text-left py-2 pr-4">Payout Address</th>
                  <th className="text-left py-2 pr-4">Currency</th>
                  <th className="text-right py-2 pr-4">Referred</th>
                  <th className="text-right py-2 pr-4">Accrued (USD)</th>
                  <th className="text-right py-2 pr-4">Paid (USD)</th>
                  <th className="text-right py-2">Balance (USD)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t border-white/10 text-gray-200">
                    <td className="py-2 pr-4">{u.display_name || u.username}</td>
                    <td className="py-2 pr-4 font-mono break-all">{u.referral_payout_address || '—'}</td>
                    <td className="py-2 pr-4">{u.referral_payout_currency || '—'}</td>
                    <td className="py-2 pr-4 text-right">{u.totals.referred_count}</td>
                    <td className="py-2 pr-4 text-right">${u.totals.accrued_usd.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right">${u.totals.paid_usd.toFixed(2)}</td>
                    <td className="py-2 text-right">${u.totals.balance_usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin overview does not include ledger rows per user. Add a per-user drilldown later if needed. */}
      </div>
    </AdminLayout>
  )
}


