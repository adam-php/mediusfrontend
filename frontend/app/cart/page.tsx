"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { apiRequest, authApiRequest } from "@/lib/api"
import TiltCard from "@/components/ui/tilt-card"
import ScrollFadeIn from "@/components/ui/scroll-fade-in"
import Link from "next/link"

type Group = { payment_method: 'crypto' | 'paypal'; currency: string; items: any[]; total_usd: number }
type Aggregator = { currency: string; address: string; required: number; balance?: number }

export default function CartPage() {
  const [items, setItems] = useState<any[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [lines, setLines] = useState<any[]>([])
  const [aggs, setAggs] = useState<Aggregator[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [paypalOrders, setPaypalOrders] = useState<{order_id: string; approval_url?: string}[]>([])
  const [approvedAck, setApprovedAck] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL!, [])

  useEffect(() => {
    const init = async () => {
      try {
        await loadCart()
        // detect PayPal return signal
        try {
          const url = new URL(window.location.href)
          const pp = url.searchParams.get('paypal')
          if (pp === 'success') {
            setMessage('PayPal approval completed. If you had multiple PayPal groups, approve each, then finalize.')
            // clean the URL (no reload)
            url.searchParams.delete('paypal')
            window.history.replaceState({}, '', url.toString())
          } else if (pp === 'cancel') {
            setMessage('PayPal approval was cancelled. You can try again.')
            url.searchParams.delete('paypal')
            window.history.replaceState({}, '', url.toString())
          }
        } catch {}
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(() => {
      refreshFunding()
    }, 10000)
    return () => clearInterval(interval)
  }, [sessionId])

  const loadCart = async () => {
    setError("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Please log in to view your cart.')
      return
    }
    const res = await authApiRequest(`${apiBase}/api/cart`, session)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to load cart')
      return
    }
    const data = await res.json()
    const rawItems = data.items || []
    setItems(rawItems)
    setGroups(data.groups || [])
    // Fallback: build line_items on the client if API is older/missing the field
    const buildLines = (itemsArr: any[]) => {
      const acc: Record<string, any> = {}
      for (const it of (itemsArr || [])) {
        const listing = it.listing || {}
        const pm = String(it.payment_method || '').toLowerCase()
        const cc = String(it.selected_currency || (pm === 'paypal' ? 'USD' : '')).toUpperCase()
        const unit = Number(listing.price_usd || 0)
        const qty = Number(it.quantity || 1)
        const key = `${it.listing_id}|${pm}|${cc}`
        if (!acc[key]) {
          acc[key] = {
            listing_id: it.listing_id,
            title: listing.title,
            payment_method: pm,
            currency: cc,
            quantity: 0,
            unit_price_usd: unit,
            total_usd: 0,
          }
        }
        acc[key].quantity += qty
        acc[key].total_usd = Math.round((acc[key].quantity * unit + Number.EPSILON) * 100) / 100
      }
      return Object.values(acc)
    }
    const lineItems = (data.line_items && data.line_items.length > 0) ? data.line_items : buildLines(rawItems)
    setLines(lineItems)
  }

  const startCheckout = async () => {
    setError("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    if (groups.length === 0) return
    const res = await authApiRequest(`${apiBase}/api/cart/checkout`, session, {
      method: 'POST'
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Checkout failed')
      return
    }
    const data = await res.json()
    setSessionId(data.session_id)
    setAggs(data.crypto_aggregators || [])
    setGroups(data.groups || groups)
    setPaypalOrders((data.paypal || []).map((o: any) => ({ order_id: o.order_id, approval_url: o.approval_url })) )
    setMessage('Send crypto to the address(es) below until fully funded, then finalize.')
  }

  const refreshFunding = async () => {
    if (!sessionId) return
    setError("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${apiBase}/api/cart/crypto/check-funding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ session_id: sessionId })
    })
    if (!res.ok) return
    const data = await res.json()
    setAggs(data.crypto_aggregators || aggs)
    if (data.all_funded) setMessage('All crypto funded. You can finalize checkout now.')
  }

  const finalize = async () => {
    if (!sessionId) return
    setError("")
    setFinalizing(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${apiBase}/api/cart/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ session_id: sessionId, paypal_orders: paypalOrders })
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Finalize failed')
      setFinalizing(false)
      return
    }
    setMessage('Checkout completed. Escrows created.')
    await loadCart()
    setFinalizing(false)
  }

  const openAllApprovals = () => {
    paypalOrders.forEach(o => { if (o.approval_url) window.open(o.approval_url, '_blank', 'noopener,noreferrer') })
  }

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMessage('Copied address to clipboard.') } catch {}
  }

  // Debounced queue to avoid rate limiting (per line key)
  const debounceRef = (globalThis as any).__cartDebounceRef || {}
  ;(globalThis as any).__cartDebounceRef = debounceRef

  const updateQty = async (line: any, quantity: number) => {
    setError("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const key = `${line.listing_id}|${line.payment_method}|${line.currency || ''}`
    // Optimistic UI update
    const prevLines = lines
    const nextLines = (() => {
      const copy = prevLines.map(l => ({ ...l }))
      const idx = copy.findIndex(l => l.listing_id === line.listing_id && l.payment_method === line.payment_method && (l.currency || '') === (line.currency || ''))
      if (idx >= 0) {
        if (quantity <= 0) {
          copy.splice(idx, 1)
        } else {
          copy[idx].quantity = quantity
          const unit = Number(copy[idx].unit_price_usd || 0)
          copy[idx].total_usd = Math.round((quantity * unit + Number.EPSILON) * 100) / 100
        }
      } else if (quantity > 0) {
        copy.push({
          listing_id: line.listing_id,
          title: line.title,
          payment_method: line.payment_method,
          currency: line.currency,
          quantity,
          unit_price_usd: line.unit_price_usd,
          total_usd: Math.round((quantity * Number(line.unit_price_usd || 0) + Number.EPSILON) * 100) / 100,
        })
      }
      return copy
    })()
    setLines(nextLines)
    // Small debounce (consecutive clicks merge)
    const now = Date.now()
    const entry = debounceRef[key] || { timer: 0, last: 0 }
    if (now - (entry.last || 0) < 200) {
      clearTimeout(entry.timer)
      entry.timer = window.setTimeout(() => updateQty(line, quantity), 220)
      entry.last = now
      debounceRef[key] = entry
      return
    }
    entry.last = now
    debounceRef[key] = entry

    setUpdating(prev => ({ ...prev, [key]: true }))

    const res = await fetch(`${apiBase}/api/cart/qty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({
        listing_id: line.listing_id,
        payment_method: line.payment_method,
        selected_currency: line.currency,
        quantity
      })
    })
    if (res.ok) { await loadCart(); setUpdating(prev => ({ ...prev, [key]: false })); return }
    // Fallback path for environments where /api/cart/qty is not available
    try {
      const cartRes = await fetch(`${apiBase}/api/cart`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' }
      })
      const cartData = await cartRes.json()
      const matchItems = (cartData.items || []).filter((it: any) => {
        const pm = String(it.payment_method || '').toLowerCase()
        const cc = String(it.selected_currency || (pm === 'paypal' ? 'USD' : '')).toUpperCase()
        return it.listing_id === line.listing_id && pm === line.payment_method && cc === (line.currency || '')
      })
      // Remove existing items for this line
      for (const it of matchItems) {
        await fetch(`${apiBase}/api/cart/${it.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' }
        })
      }
      // Recreate with desired quantity
      if (quantity > 0) {
        const body: any = { listing_id: line.listing_id, payment_method: line.payment_method, quantity }
        if (line.payment_method === 'crypto') body.selected_currency = line.currency
        await fetch(`${apiBase}/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify(body)
        })
      }
      await loadCart()
      setUpdating(prev => ({ ...prev, [key]: false }))
    } catch (e) {
      const j = await res.json().catch(() => ({}))
      setError((j && j.error) || 'Failed to update cart')
      // revert optimistic update on failure
      setLines(prevLines)
      setUpdating(prev => ({ ...prev, [key]: false }))
    }
  }

  const allCryptoFunded = aggs.length === 0 || aggs.every(a => (a.balance ?? 0) >= a.required)
  const paypalReady = paypalOrders.length === 0 || approvedAck
  const canFinalize = Boolean(sessionId) && allCryptoFunded && paypalReady

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading cart...</div>

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Top-left glow */}
      <div
        className="absolute top-0 left-0 -z-10 rounded-2xl overflow-hidden pointer-events-none mix-blend-screen"
        style={{
          width: "min(50vw, 50vh)",
          height: "min(50vw, 50vh)",
          background:
            "radial-gradient(28% 28% at 18% 14%, rgba(255,180,110,0.78) 0%, rgba(255,180,110,0.00) 60%), " +
            "radial-gradient(70% 70% at 25% 20%, rgba(251,146,60,0.62) 0%, rgba(251,146,60,0.00) 62%), " +
            "linear-gradient(135deg, rgba(251,146,60,0.34) 0%, rgba(251,146,60,0.00) 70%)",
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Cart<span className="text-orange-400">.</span></h1>
            <p className="text-gray-400">Review your items and proceed to checkout</p>
          </div>
          <button onClick={startCheckout} disabled={lines.length=== 0} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 disabled:opacity-50">Start checkout</button>
        </div>

        {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
        {message && <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 text-blue-200">{message}</div>}

        {lines.length === 0 ? (
          <div className="text-gray-400">Your cart is empty. <Link href="/marketplace" className="text-orange-400 hover:underline">Continue shopping</Link></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items list */}
            <div className="lg:col-span-2 space-y-4">
              {lines.map((ln, idx) => (
                <ScrollFadeIn key={idx}>
                  <div className="px-4 py-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3">
                    <div className="h-14 w-14 rounded-lg bg-white/10" />
                    <div className="flex-1">
                      <div className="text-sm text-white/90">{ln.title}</div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">
                        {ln.payment_method === 'paypal' ? 'PayPal' : `Crypto • ${ln.currency}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(ln, Math.max(0, (ln.quantity || 1) - 1))} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20">-</button>
                      <div className="w-8 text-center text-white/90">{ln.quantity}</div>
                      <button onClick={() => updateQty(ln, (ln.quantity || 1) + 1)} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20">+</button>
                      {updating[`${ln.listing_id}|${ln.payment_method}|${ln.currency || ''}`] && (
                        <svg className="ml-2 h-4 w-4 animate-spin text-white/70" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-100" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
                        </svg>
                      )}
                    </div>
                    <div className="w-24 text-right text-sm text-white/90">${ln.total_usd.toFixed(2)}</div>
                  </div>
                </ScrollFadeIn>
              ))}
            </div>
            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-lg font-semibold text-white/90">Order summary</div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>${lines.reduce((s,l)=>s+l.total_usd,0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Crypto total</span>
                    <span>${lines.filter(l=>l.payment_method==='crypto').reduce((s,l)=>s+l.total_usd,0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PayPal total</span>
                    <span>${lines.filter(l=>l.payment_method==='paypal').reduce((s,l)=>s+l.total_usd,0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between text-white/90 font-semibold">
                  <span>Total</span>
                  <span>${lines.reduce((s,l)=>s+l.total_usd,0).toFixed(2)}</span>
                </div>
                <button onClick={startCheckout} disabled={lines.length===0} className="w-full mt-2 px-4 py-2 rounded-xl bg-[#EA580C] text-white font-semibold hover:opacity-95 disabled:opacity-50">Start checkout</button>
              </div>
            </div>
          </div>
        )}

        {sessionId && aggs.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm text-gray-300">Crypto funding</div>
            {aggs.map((a, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-gray-300">{a.currency} deposit address</div>
                  <div className="text-gray-300">{(a.balance ?? 0).toFixed(8)} / {a.required}</div>
                </div>
                <div className="font-mono break-all text-white/90">{a.address}</div>
                <div className="mt-1 flex items-center gap-2">
                  <button onClick={() => copy(a.address)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-xs">Copy</button>
                  <div className="flex-1 h-2 rounded bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-500/60" style={{ width: `${Math.min(100, Math.max(0, ((a.balance ?? 0) / (a.required || 1)) * 100))}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button onClick={refreshFunding} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20">Refresh funding</button>
              <button onClick={finalize} disabled={!canFinalize || finalizing} className="px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white disabled:opacity-50">{finalizing ? 'Finalizing...' : 'Finalize'}</button>
            </div>
            {!allCryptoFunded && <div className="text-xs text-gray-400">Finalize will unlock after funding is complete.</div>}
          </div>
        )}
        {sessionId && paypalOrders.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm text-gray-300">PayPal approvals</div>
            {paypalOrders.map((o, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="text-gray-300">Order {o.order_id}</div>
                {o.approval_url ? (
                  <a href={o.approval_url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200">Approve</a>
                ) : (
                  <span className="text-gray-500">Ready</span>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button onClick={openAllApprovals} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20">Open all approvals</button>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={approvedAck} onChange={(e)=>setApprovedAck(e.target.checked)} />
                I approved all PayPal orders
              </label>
            </div>
            {!paypalReady && <div className="text-xs text-gray-400">Finalize will unlock after you approve all PayPal orders.</div>}
          </div>
        )}
      </div>
    </div>
  )
}


