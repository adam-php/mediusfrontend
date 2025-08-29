"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type ReferralSummary = {
  username?: string
  referral_code?: string
  referral_link?: string
  rate?: number
  referred_count?: number
  referred_users?: Array<{
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
    created_at: string
  }>
  entries?: Array<{
    id: string
    escrow_id: string
    amount_usd?: number | string | null
    currency?: string | null
    rate?: number | string | null
    status: string
    created_at: string
    referred_user_id?: string | null
  }>
  balance_usd?: number | string
  withdrawals?: Array<{
    id: string
    amount_usd: number | string
    currency: string
    to_address: string
    status: string
    created_at: string
    paid_at?: string | null
    tx_hash?: string | null
    amount_crypto?: number | string | null
    exchange_rate?: number | string | null
  }>
}

type Currency = { code: string; name: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")

export default function ReferralsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ReferralSummary | null>(null)

  const [claimCode, setClaimCode] = useState("")
  const [claimMsg, setClaimMsg] = useState("")
  const [claimLoading, setClaimLoading] = useState(false)

  const [amountUsd, setAmountUsd] = useState("")
  const [payoutCurrency, setPayoutCurrency] = useState("BTC")
  const [toAddress, setToAddress] = useState("")
  const [withdrawing, setWithdrawing] = useState(false)
  const [wdMsg, setWdMsg] = useState("")
  const [wdError, setWdError] = useState("")

  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [currLoading, setCurrLoading] = useState(false)

  const payoutCurrencyOptions = useMemo(() => {
    const list = Array.isArray(currencies) ? currencies : []
    // Fallback if API fails
    if (list.length === 0) {
      return [
        { code: "USD", name: "PayPal" },
        { code: "BTC", name: "Bitcoin" },
        { code: "ETH", name: "Ethereum" },
        { code: "LTC", name: "Litecoin" },
        { code: "TRX", name: "Tron" },
        { code: "USDT-TRON", name: "Tether (USDT) — TRC20 (Tron)" },
      ]
    }
    return list
  }, [currencies])

  // Generate referral link client-side if not provided by backend
  const referralLink = useMemo(() => {
    // If backend provides a link, use it
    if (summary?.referral_link) return summary.referral_link
    
    // Otherwise generate it from the current host
    const code = summary?.referral_code?.trim()
    if (code) {
      const baseUrl = SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")
      // Route referrals through the auth page which supports ?ref
      return `${baseUrl}/auth?ref=${code}`
      // Or if you have a dedicated ref route: `${baseUrl}/ref/${code}`
    }
    return ""
  }, [summary])

  const formatUSD = (val: number | string | undefined | null) => {
    const n = typeof val === "string" ? Number(val) : (val ?? 0)
    const parsed = Number.isFinite(n) ? Number(n) : 0
    return parsed.toFixed(2)
  }

  const copy = async (text: string) => {
    try { 
      await navigator.clipboard.writeText(text)
      // Optional: Show a toast/notification that it was copied
    } catch {}
  }

  const load = async () => {
    setLoading(true)
    setError("")
    setWdMsg("")
    setWdError("")
    setClaimMsg("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = "/auth"
        return
      }

      // Load summary
      const res = await fetch(`${API_URL}/api/referrals/summary?ngrok-skip-browser-warning=true`, {
        headers: { Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load referrals")
      setSummary(json as ReferralSummary)

      // Load supported currencies (best-effort)
      setCurrLoading(true)
      try {
        const cRes = await fetch(`${API_URL}/api/supported-currencies?ngrok-skip-browser-warning=true`, {
          headers: { 'ngrok-skip-browser-warning': '1' },
          cache: 'no-store',
        })
        if (cRes.ok) {
          const list: Currency[] = await cRes.json()
          setCurrencies(Array.isArray(list) ? list : [])
        } else {
          setCurrencies([])
        }
      } catch {
        setCurrencies([])
      } finally {
        setCurrLoading(false)
      }

      // Default payout currency (if not set yet)
      if (!payoutCurrency) setPayoutCurrency("BTC")
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const claim = async () => {
    setClaimMsg("")
    setError("")
    setClaimLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = "/auth"; return }
      if (!claimCode.trim()) throw new Error("Enter a referral code or username")

      const res = await fetch(`${API_URL}/api/referrals/claim?ngrok-skip-browser-warning=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ code: claimCode.trim() })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || "Failed to claim code")
      setClaimMsg("Referral claimed! 🎉")
      setClaimCode("")
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setClaimLoading(false)
    }
  }

  const withdraw = async () => {
    setWdMsg("")
    setWdError("")
    setError("")
    try {
      const amt = Number.parseFloat(amountUsd)
      if (!amt || Number.isNaN(amt)) { setWdError("Enter a valid USD amount"); return }
      if (amt < 1) { setWdError("Minimum withdrawal is $1"); return }
      if (summary?.balance_usd != null && amt > Number(summary.balance_usd)) {
        setWdError("Insufficient referral balance")
        return
      }
      if (!payoutCurrency) { setWdError("Select a payout currency"); return }
      if (!toAddress || toAddress.trim().length < 10) {
        setWdError("Enter a valid payout address")
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = "/auth"; return }

      setWithdrawing(true)
      const res = await fetch(`${API_URL}/api/referrals/withdraw?ngrok-skip-browser-warning=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({
          amount_usd: amt,
          currency: payoutCurrency,
          to_address: toAddress
        })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || "Withdrawal failed")
      setWdMsg(`Withdrawal submitted. ${j.tx_hash ? `Tx: ${j.tx_hash}` : ""}`)
      setAmountUsd("")
      setToAddress("")
      await load()
    } catch (e: any) {
      setWdError(e?.message ?? String(e))
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading referrals…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-5xl mb-2">⚠️</div>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    )
  }

  const displayRate = typeof summary?.rate === "number"
    ? `${(summary.rate * 100).toFixed(0)}%`
    : "—"

  const balanceUsd = summary?.balance_usd != null
    ? formatUSD(summary.balance_usd)
    : "0.00"

  const entries = summary?.entries || []
  const withdrawals = summary?.withdrawals || []

  const withdrawAmountNumber = Number.parseFloat(amountUsd || "0")
  const withdrawDisabled =
    withdrawing ||
    !withdrawAmountNumber ||
    withdrawAmountNumber < 1 ||
    (summary?.balance_usd != null && withdrawAmountNumber > Number(summary.balance_usd)) ||
    !toAddress || toAddress.trim().length < 10

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Share + claim */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h1 className="text-3xl font-bold mb-4">Referrals</h1>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-sm text-gray-400 mb-1">Your referral code</div>
              <div className="flex items-center gap-3">
                <div className="text-xl font-mono">{summary?.referral_code ?? "—"}</div>
                <button
                  onClick={() => copy(summary?.referral_code ?? "")}
                  className="ml-auto rounded-lg px-3 py-1.5 bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-sm text-gray-400 mb-1">Referral link</div>
              <div className="flex items-center gap-3">
                <div className="truncate">{referralLink || "—"}</div>
                <button
                  onClick={() => copy(referralLink)}
                  className="ml-auto rounded-lg px-3 py-1.5 bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="text-sm text-gray-400 mb-2">Claim a referral (optional)</div>
            <div className="flex gap-2">
              <input
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value)}
                placeholder="Enter code or username"
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <button
                onClick={claim}
                disabled={claimLoading || !claimCode.trim()}
                className="rounded-xl bg-[#FF7A00] hover:bg-[#FF7A00] text-white px-5 py-3 font-semibold disabled:opacity-50"
              >
                {claimLoading ? "Claiming…" : "Claim"}
              </button>
            </div>
            {claimMsg && <div className="mt-2 text-green-400 text-sm">{claimMsg}</div>}
          </div>
        </div>

        {/* Earnings & withdraw */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Earnings</h2>
              <div className="text-sm text-gray-300">Rate: {displayRate} of platform fee (crypto escrows only)</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-2xl font-bold">${balanceUsd}</div>
            </div>
          </div>

          {/* Withdraw */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="text-sm text-gray-300 mb-2">Withdraw (min $1)</div>
            <div className="grid gap-3 sm:grid-cols-[1fr,180px,1fr]">
              <input
                type="number"
                min={1}
                step="0.01"
                placeholder="Amount (USD)"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <select
                value={payoutCurrency}
                onChange={(e) => setPayoutCurrency(e.target.value)}
                className="rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                {payoutCurrencyOptions.map((c) => (
                  <option key={c.code} value={c.code} disabled={c.code === "USD"}>{c.code}</option>
                ))}
              </select>
              <input
                placeholder="Payout address"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="rounded-xl bg-white/10 px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={withdraw}
                disabled={withdrawDisabled}
                className="rounded-xl bg-[#FF7A00] hover:bg-[#FF7A00] text-white px-6 py-3 font-semibold disabled:opacity-50"
              >
                {withdrawing ? "Processing…" : "Withdraw"}
              </button>
              {wdMsg && <div className="text-green-400 text-sm">{wdMsg}</div>}
              {wdError && <div className="text-red-400 text-sm">{wdError}</div>}
            </div>
            {summary?.balance_usd != null && (
              <div className="text-xs text-gray-400 mt-2">
                Available balance: ${formatUSD(summary.balance_usd)}
              </div>
            )}
            {currLoading && (
              <div className="text-xs text-gray-400 mt-2">Loading payout currencies…</div>
            )}
            <div className="text-xs text-gray-500 mt-2">Note: USD withdrawals are not supported. Use a crypto network; ensure the address/network matches (TRON/TRC20 supported).</div>
          </div>

          {/* Commission entries */}
          <div className="overflow-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-300">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Escrow</th>
                  <th className="text-left px-4 py-2">Referred</th>
                  <th className="text-left px-4 py-2">Amount (USD)</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-white/10">
                    <td className="px-4 py-2">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">#{String(e.escrow_id).slice(0, 8)}</td>
                    <td className="px-4 py-2">{e.referred_user_id?.slice(0, 8) ?? "-"}</td>
                    <td className="px-4 py-2">
                      {e.amount_usd != null ? `$${formatUSD(e.amount_usd)}` : (e.amount_usd ?? "-")}
                    </td>
                    <td className="px-4 py-2 capitalize">{e.status}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-gray-500" colSpan={5}>No commission yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Withdrawals history */}
          <div className="overflow-auto rounded-2xl border border-white/10">
            <div className="px-4 py-2 text-gray-300 font-semibold">Withdrawals</div>
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-300">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Amount (USD)</th>
                  <th className="text-left px-4 py-2">Currency</th>
                  <th className="text-left px-4 py-2">Address</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-white/10">
                    <td className="px-4 py-2">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">${formatUSD(w.amount_usd)}</td>
                    <td className="px-4 py-2">{w.currency}</td>
                    <td className="px-4 py-2 truncate max-w-[240px]" title={w.to_address}>{w.to_address}</td>
                    <td className="px-4 py-2 capitalize">{w.status}</td>
                    <td className="px-4 py-2">
                      {w.tx_hash ? (
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="text-orange-300 underline"
                          title={w.tx_hash}
                        >
                          {w.tx_hash.slice(0, 10)}…
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-gray-500" colSpan={6}>No withdrawals yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Referred users */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-2xl font-bold mb-3">Referred users ({summary?.referred_count || 0})</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(summary?.referred_users || []).map((u) => (
              <a key={u.id} href={`/profiles/${u.username}`} className="rounded-xl border border-white/15 bg-white/5 p-3 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <span>👤</span>}
                  </div>
                  <div>
                    <div className="font-semibold">@{u.username}</div>
                    {u.display_name && <div className="text-xs text-gray-400">{u.display_name}</div>}
                  </div>
                </div>
              </a>
            ))}
            {(summary?.referred_users || []).length === 0 && (
              <div className="text-gray-400 text-sm">No referred users yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}