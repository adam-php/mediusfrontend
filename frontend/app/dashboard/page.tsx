"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Escrow } from "@/lib/types"

export default function Dashboard() {
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    totalValue: 0
  })
  const [prices, setPrices] = useState<Record<string, number>>({}) // live crypto prices
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth")
        return
      }
      setUser(user)
      fetchEscrows(user.id)
      fetchPrices()            // fetch prices once at load
      const id = setInterval(fetchPrices, 60_000) // refresh each minute
      return () => clearInterval(id)
    }

    checkUser()
  }, [router])

  const fetchPrices = async () => {
    try {
      const idMap: Record<string, string> = {
        BTC: "bitcoin",
        ETH: "ethereum",
        LTC: "litecoin",
        BCH: "bitcoin-cash",
        DOGE: "dogecoin",
        XRP: "ripple",
        ADA: "cardano",
        DOT: "polkadot",
        MATIC: "matic-network",
        SOL: "solana",
        AVAX: "avalanche-2",
        TRX: "tron",
        BNB: "binancecoin",
        ATOM: "cosmos",
        XLM: "stellar"
      }
      const ids = Object.values(idMap).join(",")
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
      )
      if (!res.ok) throw new Error("price fetch failed")
      const data = await res.json()
      const p: Record<string, number> = {}
      for (const [sym, id] of Object.entries(idMap)) {
        if (data[id]?.usd) p[sym] = data[id].usd
      }
      setPrices(p)
    } catch (e) {
      console.warn("Price fetch error, using cached values", e)
    }
  }

  const fetchEscrows = async (userId: string) => {
    try {
      // Fetch only escrows where user is buyer OR seller
      const { data, error } = await supabase
        .from("escrows")
        .select("*")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false })

      if (error) throw error
      
      const escrowData = data || []
      setEscrows(escrowData)
      
    } catch (error) {
      console.error("Error fetching escrows:", error)
    } finally {
      setLoading(false)
    }
  }

  // Recalculate stats whenever escrows or prices change
  useEffect(() => {
    if (escrows.length > 0) {
      // ── calculate USD value with live price fallback (only completed escrows) ──
      const totalUsd = escrows
        .filter(e => e.status === 'completed')
        .reduce((sum, e) => {
          if (e.currency === "USD" || e.payment_method === "paypal") {
            return sum + Number(e.usd_amount ?? e.amount)
          }
          const live = prices[e.currency]
          if (live) return sum + Number(e.amount) * live
          return sum + Number(e.usd_amount ?? 0) // fallback
        }, 0)

      // Calculate stats
      const newStats = {
        total: escrows.length,
        completed: escrows.filter(e => e.status === 'completed').length,
        pending: escrows.filter(e => e.status === 'pending' || e.status === 'funded').length,
        totalValue: totalUsd
      }
      setStats(newStats)
    }
  }, [escrows, prices])

  const getUserRole = (escrow: Escrow) => {
    if (!user) return "Unknown"
    if (escrow.buyer_id === user.id) return "Buyer"
    if (escrow.seller_id === user.id) return "Seller"
    return "Observer"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
      case "funded":
        return "bg-blue-500/20 text-blue-300 border-blue-400/30"
      case "confirmed":
        return "bg-purple-500/20 text-purple-300 border-purple-400/30"
      case "completed":
        return "bg-green-500/20 text-green-300 border-green-400/30"
      case "disputed":
        return "bg-red-500/20 text-red-300 border-red-400/30"
      case "cancelled":
        return "bg-gray-500/20 text-gray-300 border-gray-400/30"
      case "refunded":
        return "bg-orange-500/20 text-orange-300 border-orange-400/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-400/30"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-float-slow-reverse"></div>

        <div className="flex items-center space-x-3 text-white relative z-10 animate-fade-in">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg">Loading your escrows...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-float-slow-reverse"></div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-8 space-y-4 lg:space-y-0">
            <div className="animate-slide-in-left">
              <h1 className="text-4xl font-bold text-white mb-2">
                Dashboard
                <span className="text-orange-400">.</span>
              </h1>
              <p className="text-gray-400">Manage your escrow transactions</p>
              {user && (
                <div className="flex items-center mt-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-glow-gentle"></div>
                  <span className="text-sm text-gray-400">Welcome back, {user.email}</span>
                </div>
              )}
            </div>
            <Link
              href="/create-escrow"
              className="backdrop-blur-sm bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 inline-flex items-center space-x-2 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 relative overflow-hidden group hover:scale-105 transform ease-out animate-slide-in-right"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10">Create New Escrow</span>
              <span className="relative z-10 group-hover:translate-x-1 transition-transform duration-300">→</span>
            </Link>
          </div>

          {/* Stats Cards */}
          {escrows.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 animate-fade-in-up">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-orange-400 text-xl">📊</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Escrows</p>
                    <p className="text-white text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </div>
              
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-green-400 text-xl">✅</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Completed</p>
                    <p className="text-white text-2xl font-bold">{stats.completed}</p>
                  </div>
                </div>
              </div>
              
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-yellow-400 text-xl">⏳</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Pending</p>
                    <p className="text-white text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </div>
              
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-blue-400 text-xl">💰</span>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Value</p>
                    <p className="text-white text-2xl font-bold">
                      ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {escrows.length === 0 ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl shadow-orange-500/10 relative overflow-hidden hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-fade-in-up">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

              <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm border border-orange-400/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20 hover:scale-110 transition-transform duration-300 ease-out animate-bounce-gentle">
                  <span className="text-orange-400 font-bold text-3xl">M</span>
                </div>
                <h3
                  className="text-2xl font-bold text-white mb-4 animate-slide-in-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  No Escrows Yet<span className="text-orange-400">.</span>
                </h3>
                <p
                  className="text-gray-400 mb-6 max-w-md mx-auto animate-slide-in-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  You haven't created or participated in any escrow transactions yet. Start by creating your first
                  secure transaction.
                </p>
                <Link
                  href="/create-escrow"
                  className="inline-flex items-center space-x-2 backdrop-blur-sm bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:scale-105 transform ease-out animate-slide-in-up"
                  style={{ animationDelay: "0.3s" }}
                >
                  <span>Create Your First Escrow</span>
                  <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 animate-slide-in-up">
                <h2 className="text-xl font-semibold text-gray-300">Your Escrows ({escrows.length})</h2>
              </div>

              <div className="grid gap-6">
                {escrows.map((escrow, index) => (
                  <div
                    key={escrow.id}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-white/20 hover:bg-white/10 transition-all duration-500 ease-out group shadow-xl shadow-orange-500/5 hover:shadow-orange-500/10 relative overflow-hidden hover:scale-[1.02] transform animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="relative z-10">
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-4 space-y-3 lg:space-y-0">
                      <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-bold text-white group-hover:text-orange-100 transition-colors duration-300">
                              Escrow #{escrow.id.slice(0, 8)}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm hover:scale-105 transition-transform duration-300 ${getStatusColor(
                                escrow.status,
                              )}`}
                            >
                              {escrow.status.toUpperCase()}
                            </span>
                            <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded-lg text-xs font-medium">
                              {getUserRole(escrow)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-400">
                            <div className="flex items-center space-x-2 hover:text-orange-300 transition-colors duration-300">
                              <span className="text-orange-400">💰</span>
                              <span>
                                {escrow.amount} {escrow.currency}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 hover:text-orange-300 transition-colors duration-300">
                              <span className="text-orange-400">💵</span>
                              <span>${(() => {
                                const usd = escrow.currency === "USD" || escrow.payment_method === "paypal"
                                  ? Number(escrow.usd_amount ?? escrow.amount)
                                  : prices[escrow.currency]
                                  ? Number(escrow.amount) * prices[escrow.currency]
                                  : Number(escrow.usd_amount ?? 0)
                                return usd.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              })()} USD</span>
                            </div>
                            <div className="flex items-center space-x-2 hover:text-orange-300 transition-colors duration-300">
                              <span className="text-orange-400">⚡</span>
                              <span className="capitalize">{escrow.payment_method}</span>
                            </div>
                            <div className="flex items-center space-x-2 hover:text-orange-300 transition-colors duration-300">
                              <span className="text-orange-400">📅</span>
                              <span>{new Date(escrow.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0 text-sm">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                escrow.buyer_confirmed
                                  ? "bg-green-500 shadow-lg shadow-green-500/50 animate-glow-gentle"
                                  : "bg-gray-600 hover:bg-gray-500"
                              }`}
                            ></div>
                            <span className="text-gray-300 hover:text-white transition-colors duration-300">
                              Buyer {escrow.buyer_confirmed ? "Confirmed" : "Pending"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                escrow.seller_confirmed
                                  ? "bg-green-500 shadow-lg shadow-green-500/50 animate-glow-gentle"
                                  : "bg-gray-600 hover:bg-gray-500"
                              }`}
                            ></div>
                            <span className="text-gray-300 hover:text-white transition-colors duration-300">
                              Seller {escrow.seller_confirmed ? "Confirmed" : "Pending"}
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/escrow/${escrow.id}`}
                          className="text-orange-400 hover:text-orange-300 font-medium transition-all duration-300 group-hover:text-orange-300 inline-flex items-center space-x-1 backdrop-blur-sm bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1 rounded-xl border border-orange-400/20 hover:border-orange-400/40 hover:scale-105 transform ease-out"
                        >
                          <span>View Details</span>
                          <span className="transform group-hover:translate-x-1 transition-transform duration-300">
                            →
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}