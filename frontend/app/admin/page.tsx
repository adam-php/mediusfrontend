'use client'

import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import {
  Users,
  FileText,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  Shield
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface AdminOverview {
  timestamp: string
  users: {
    total: number
    active_24h: number
  }
  escrows: {
    total: number
    active: number
    completed: number
    recent_24h: number
  }
  transactions: {
    total: number
    recent_24h: number
  }
  revenue: {
    total_platform_fees_usd: number
    currency_breakdown: Record<string, number>
  }
  system_health: {
    supabase_connected: boolean
    crypto_enabled: boolean
    paypal_enabled: boolean
  }
}

interface SystemStatus {
  timestamp: string
  uptime: string
  database: {
    connected: boolean
    tables_status: Record<string, string>
  }
  external_services: {
    tatum_api: boolean
    paypal_api: boolean
    coin_gecko: boolean
  }
  security: {
    encryption_configured: boolean
    rate_limiting_enabled: boolean
    audit_logging_enabled: boolean
  }
  platform_wallets: Record<string, { configured: boolean; address: string }>
  system_config: {
    referral_rate: number
    min_withdrawal_usd: number
    max_escrow_amount: number
    min_escrow_amount: number
  }
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      // For now, let's use mock data to show the UI
      // Replace with actual API calls when backend is ready
      const mockOverview: AdminOverview = {
        timestamp: new Date().toISOString(),
        users: {
          total: 1247,
          active_24h: 23
        },
        escrows: {
          total: 3456,
          active: 234,
          completed: 3122,
          recent_24h: 45
        },
        transactions: {
          total: 5678,
          recent_24h: 89
        },
        revenue: {
          total_platform_fees_usd: 12543.67,
          currency_breakdown: {
            'BTC': 2.5,
            'ETH': 15.8,
            'USDT': 45.2,
            'USD': 36.5
          }
        },
        system_health: {
          supabase_connected: true,
          crypto_enabled: true,
          paypal_enabled: false
        }
      }

      const mockSystemStatus: SystemStatus = {
        timestamp: new Date().toISOString(),
        uptime: "7 days, 4 hours",
        database: {
          connected: true,
          tables_status: {
            'profiles': 'healthy',
            'escrows': 'healthy',
            'transactions': 'healthy',
            'referral_payouts': 'healthy'
          }
        },
        external_services: {
          tatum_api: true,
          paypal_api: false,
          coin_gecko: true
        },
        security: {
          encryption_configured: true,
          rate_limiting_enabled: true,
          audit_logging_enabled: true
        },
        platform_wallets: {
          'BTC': { configured: true, address: '1A2B3C4D5E...' },
          'ETH': { configured: true, address: '0x1234...' },
          'USDT': { configured: true, address: 'TRON123...' }
        },
        system_config: {
          referral_rate: 0.1,
          min_withdrawal_usd: 5.0,
          max_escrow_amount: 100000,
          min_escrow_amount: 0.001
        }
      }

      setOverview(mockOverview)
      setSystemStatus(mockSystemStatus)

      // Fetch real data from backend API
      try {
        const overviewRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "ngrok-skip-browser-warning": "true"
          },
        })
        if (overviewRes.ok) {
          const overviewData = await overviewRes.json()
          setOverview(overviewData)
        } else {
          console.error('Failed to fetch overview data:', overviewRes.status)
          // Keep mock data as fallback
        }
      } catch (error) {
        console.error('Error fetching overview:', error)
        // Keep mock data as fallback
      }

      try {
        const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/system/status`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "ngrok-skip-browser-warning": "true"
          },
        })
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          setSystemStatus(statusData)
        } else {
          console.error('Failed to fetch system status:', statusRes.status)
          // Keep mock data as fallback
        }
      } catch (error) {
        console.error('Error fetching system status:', error)
        // Keep mock data as fallback
      }

    } catch (err: any) {
      console.error('Dashboard fetch error:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
    color,
    link,
  }: {
    title: string
    value: string | number
    change?: string
    icon: any
    color: string
    link: string
  }) => (
    <Link href={link} className="block">
      <div
        className={`bg-black border border-white/10 rounded-lg p-4 lg:p-6 hover:bg-gray-900 transition-all duration-200 min-h-[120px] lg:h-32 ${color}`}
      >
        <div className="flex items-center justify-between h-full">
          <div className="flex flex-col justify-between h-full flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-300 truncate">{title}</p>
            <div className="min-w-0">
              <p className="text-xl lg:text-2xl font-bold text-white truncate">{value}</p>
              {change && <p className="text-sm text-green-400 truncate">{change}</p>}
            </div>
          </div>
          <Icon className="h-6 w-6 lg:h-8 lg:w-8 text-gray-400 flex-shrink-0 ml-3" />
        </div>
      </div>
    </Link>
  )

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[200px] lg:h-64">
          <div className="flex items-center space-x-2 lg:space-x-3 text-white">
            <div className="w-6 h-6 lg:w-8 lg:h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm lg:text-lg">Loading admin dashboard...</span>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50/10 border border-red-400/30 rounded-lg p-3 lg:p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5 text-red-400 mr-2 flex-shrink-0" />
            <h3 className="text-xs lg:text-sm font-medium text-red-400">Error loading dashboard</h3>
          </div>
          <p className="mt-2 text-xs lg:text-sm text-red-300">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded text-xs lg:text-sm"
          >
            Retry
          </button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-6 min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm lg:text-base">Platform overview and management</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={overview?.users.total || 0}
            icon={Users}
            color="border-blue-500/30"
            link="/admin/users"
          />
          <StatCard
            title="Active Escrows"
            value={overview?.escrows.active || 0}
            icon={FileText}
            color="border-green-500/30"
            link="/admin/escrows"
          />
          <StatCard
            title="Total Revenue"
            value={`$${overview?.revenue.total_platform_fees_usd.toFixed(2) || '0.00'}`}
            icon={DollarSign}
            color="border-purple-500/30"
            link="/admin/transactions"
          />
          <StatCard
            title="System Health"
            value={systemStatus?.database.connected ? 'Healthy' : 'Issues'}
            icon={systemStatus?.database.connected ? CheckCircle : AlertTriangle}
            color={systemStatus?.database.connected ? 'border-green-500/30' : 'border-red-500/30'}
            link="/admin/system"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-black border border-white/10 rounded-lg p-4 lg:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <Link href="/admin/users" className="flex items-center p-3 lg:p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
              <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-400 mr-3 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-white text-sm lg:text-base truncate">Manage Users</h3>
                <p className="text-xs lg:text-sm text-gray-400 hidden sm:block">View, search, and moderate users</p>
              </div>
            </Link>
            <Link href="/admin/escrows" className="flex items-center p-3 lg:p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
              <FileText className="h-5 w-5 lg:h-6 lg:w-6 text-green-400 mr-3 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-white text-sm lg:text-base truncate">Escrow Disputes</h3>
                <p className="text-xs lg:text-sm text-gray-400 hidden sm:block">Resolve escrow conflicts</p>
              </div>
            </Link>
            <Link href="/admin/transactions" className="flex items-center p-3 lg:p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors sm:col-span-2 lg:col-span-1">
              <CreditCard className="h-5 w-5 lg:h-6 lg:w-6 text-purple-400 mr-3 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-white text-sm lg:text-base truncate">Transaction Review</h3>
                <p className="text-xs lg:text-sm text-gray-400 hidden sm:block">Monitor platform transactions</p>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Service Status */}
          <div className="bg-black border border-white/10 rounded-lg p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center">
              <Shield className="h-4 w-4 lg:h-5 lg:w-5 mr-2 flex-shrink-0" />
              <span className="truncate">Service Status</span>
            </h2>
            <div className="space-y-2 lg:space-y-3">
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">Database</span>
                <span className={`flex items-center flex-shrink-0 ${systemStatus?.database.connected ? 'text-green-400' : 'text-red-400'}`}>
                  {systemStatus?.database.connected ? <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> : <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />}
                  <span className="text-xs lg:text-sm truncate">{systemStatus?.database.connected ? 'Connected' : 'Disconnected'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">Crypto API</span>
                <span className={`flex items-center flex-shrink-0 ${systemStatus?.external_services.tatum_api ? 'text-green-400' : 'text-red-400'}`}>
                  {systemStatus?.external_services.tatum_api ? <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> : <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />}
                  <span className="text-xs lg:text-sm truncate">{systemStatus?.external_services.tatum_api ? 'Enabled' : 'Disabled'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">PayPal API</span>
                <span className={`flex items-center flex-shrink-0 ${systemStatus?.external_services.paypal_api ? 'text-green-400' : 'text-red-400'}`}>
                  {systemStatus?.external_services.paypal_api ? <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> : <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />}
                  <span className="text-xs lg:text-sm truncate">{systemStatus?.external_services.paypal_api ? 'Enabled' : 'Disabled'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">Encryption</span>
                <span className={`flex items-center flex-shrink-0 ${systemStatus?.security.encryption_configured ? 'text-green-400' : 'text-red-400'}`}>
                  {systemStatus?.security.encryption_configured ? <CheckCircle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> : <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />}
                  <span className="text-xs lg:text-sm truncate">{systemStatus?.security.encryption_configured ? 'Configured' : 'Not Configured'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-black border border-white/10 rounded-lg p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center">
              <Activity className="h-4 w-4 lg:h-5 lg:w-5 mr-2 flex-shrink-0" />
              <span className="truncate">Recent Activity (24h)</span>
            </h2>
            <div className="space-y-2 lg:space-y-3">
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">New Users</span>
                <span className="text-xs lg:text-sm font-medium text-white flex-shrink-0">{overview?.users.active_24h || 0}</span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">New Escrows</span>
                <span className="text-xs lg:text-sm font-medium text-white flex-shrink-0">{overview?.escrows.recent_24h || 0}</span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">Transactions</span>
                <span className="text-xs lg:text-sm font-medium text-white flex-shrink-0">{overview?.transactions.recent_24h || 0}</span>
              </div>
              <div className="flex items-center justify-between min-w-0">
                <span className="text-xs lg:text-sm text-gray-300 truncate mr-2">Revenue</span>
                <span className="text-xs lg:text-sm font-medium text-white flex-shrink-0 truncate ml-2">${overview?.revenue.total_platform_fees_usd.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>




      </div>
    </AdminLayout>
  )
}
