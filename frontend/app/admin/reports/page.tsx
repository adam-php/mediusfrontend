"use client"

import React, { useEffect, useMemo, useState } from "react"
import AdminLayout from "../../../components/AdminLayout"
import { supabase } from "@/lib/supabase"
import { AlertTriangle, CheckCircle, Filter, RefreshCw, Shield, Settings, XCircle } from "lucide-react"

interface ReportItem {
  id: string
  reporter_id: string
  entity_type: 'listing' | 'user'
  entity_id: string
  reason?: string
  details?: any
  status: 'open' | 'triaged' | 'resolved' | 'dismissed'
  created_at: string
  updated_at?: string
  listing?: { id: string; title?: string; status?: string }
}

export default function AdminReportsPage() {
  const [items, setItems] = useState<ReportItem[]>([])
  const [status, setStatus] = useState<string>('')
  const [entityType, setEntityType] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")
  const [saving, setSaving] = useState<boolean>(false)
  const [modProvider, setModProvider] = useState<string>('openai')
  const [textThreshold, setTextThreshold] = useState<string>('0.5')
  const [imageThreshold, setImageThreshold] = useState<string>('0.5')

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL!, [])

  useEffect(() => {
    fetchReports()
    fetchModeration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, entityType])

  const fetchReports = async () => {
    setLoading(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (entityType) params.set('entity_type', entityType)
      const res = await fetch(`${apiBase}/api/admin/reports?${params.toString()}&ngrok-skip-browser-warning=true`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': 'true' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const actOnReport = async (reportId: string, action: string) => {
    const confirmMsg: Record<string, string> = {
      triage: 'Mark report as triaged?',
      resolve: 'Resolve report?',
      dismiss: 'Dismiss report?',
      pause_listing: 'Pause this listing?',
      delete_listing: 'Delete this listing?',
      ban_user: 'Ban this user?'
    }
    if (!confirm(confirmMsg[action] || 'Proceed?')) return

    setSaving(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch(`${apiBase}/api/admin/reports/${reportId}/action?ngrok-skip-browser-warning=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ action })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchReports()
    } catch (e: any) {
      setError(e.message || 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const fetchModeration = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${apiBase}/api/admin/moderation/config?ngrok-skip-browser-warning=true`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' }
      })
      if (!res.ok) return
      const cfg = await res.json()
      if (cfg.provider) setModProvider(cfg.provider)
      if (cfg.text_threshold != null) setTextThreshold(String(cfg.text_threshold))
      if (cfg.image_threshold != null) setImageThreshold(String(cfg.image_threshold))
    } catch {}
  }

  const saveModeration = async () => {
    setSaving(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch(`${apiBase}/api/admin/moderation/config?ngrok-skip-browser-warning=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ provider: modProvider, text_threshold: parseFloat(textThreshold), image_threshold: parseFloat(imageThreshold) })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchModeration()
      alert('Moderation settings saved')
    } catch (e: any) {
      setError(e.message || 'Failed to save moderation settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-gray-400">Triage user and listing reports; adjust moderation settings</p>
          </div>
          <button onClick={fetchReports} className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-lg flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

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
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white">
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="triaged">Triaged</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Entity</label>
              <select value={entityType} onChange={(e)=>setEntityType(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white">
                <option value="">All</option>
                <option value="listing">Listing</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={fetchReports} className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 px-4 py-2 rounded-md flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-gray-400">No reports.</div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-white font-medium">Report #{r.id.slice(0,8)}</div>
                    <div className="text-sm text-gray-400">Entity: {r.entity_type} {r.entity_type === 'listing' && r.listing?.title ? `“${r.listing.title}”` : r.entity_id.slice(0,8)}</div>
                    <div className="text-sm text-gray-400">Reason: {r.reason || '—'}</div>
                    <div className="text-xs text-gray-500">Created: {new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                    r.status === 'open' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30' :
                    r.status === 'triaged' ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' :
                    r.status === 'resolved' ? 'bg-green-500/20 text-green-300 border-green-400/30' :
                    'bg-gray-500/20 text-gray-300 border-gray-400/30'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={saving} onClick={()=>actOnReport(r.id,'triage')} className="px-3 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-400/30 disabled:opacity-50 flex items-center gap-1">
                    <Shield className="h-4 w-4" /> Triage
                  </button>
                  <button disabled={saving} onClick={()=>actOnReport(r.id,'resolve')} className="px-3 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30 disabled:opacity-50 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Resolve
                  </button>
                  <button disabled={saving} onClick={()=>actOnReport(r.id,'dismiss')} className="px-3 py-1 rounded bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border border-gray-400/30 disabled:opacity-50 flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> Dismiss
                  </button>
                  {r.entity_type === 'listing' && (
                    <>
                      <button disabled={saving} onClick={()=>actOnReport(r.id,'pause_listing')} className="px-3 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-400/30 disabled:opacity-50">Pause listing</button>
                      <button disabled={saving} onClick={()=>actOnReport(r.id,'delete_listing')} className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 disabled:opacity-50">Delete listing</button>
                    </>
                  )}
                  {r.entity_type === 'user' && (
                    <button disabled={saving} onClick={()=>actOnReport(r.id,'ban_user')} className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 disabled:opacity-50">Ban user</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Moderation Settings */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4 text-white">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Moderation settings</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Provider</label>
              <select value={modProvider} onChange={(e)=>setModProvider(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white">
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Text threshold</label>
              <input value={textThreshold} onChange={(e)=>setTextThreshold(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Image threshold</label>
              <input value={imageThreshold} onChange={(e)=>setImageThreshold(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <button disabled={saving} onClick={saveModeration} className="px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 hover:border-orange-400/50 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
