"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import type { Escrow, Profile } from "@/lib/types"
import EscrowChat from "@/components/EscrowChat"
import AnimatedBackButton from "@/components/animated-back-button"

interface EscrowPageProps {
  params: Promise<{ id: string }>
}

export default function EscrowPage({ params }: EscrowPageProps) {
  const router = useRouter()
  
  const [escrowId, setEscrowId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [buyerProfile, setBuyerProfile] = useState<Profile | null>(null)
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null)
  const [user, setUser] = useState<any>(null)
  const [escrowLoading, setEscrowLoading] = useState(true)
  const [showPriceChange, setShowPriceChange] = useState(false)
  const [newPrice, setNewPrice] = useState("")
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState("")
  const [error, setError] = useState("")
  const [declining, setDeclining] = useState(false)
  const [paypalProcessing, setPaypalProcessing] = useState(false)
  const [paypalMessage, setPaypalMessage] = useState("")
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setEscrowId(resolvedParams.id)
      setLoading(false)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (!escrowId || loading) return

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth")
        return
      }
      setUser(user)
      fetchEscrowDetails()
    }

    checkUser()

    const subscription = supabase
      .channel(`escrow-updates-${escrowId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "escrows", filter: `id=eq.${escrowId}` },
        (payload) => { setEscrow(payload.new as Escrow) },
      )
      .subscribe()

    const chatSubscription = supabase
      .channel(`escrow-messages-${escrowId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escrow_messages", filter: `escrow_id=eq.${escrowId}` },
        (payload) => {
          const message = payload.new
          if (message.message_type === "price_change_request" && user?.id === escrow?.buyer_id) {
            setShowPriceChange(true)
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      chatSubscription.unsubscribe()
    }
  }, [escrowId, loading, router, user?.id, escrow?.buyer_id])

  useEffect(() => {
    if (!escrow || !user || escrow.status !== "pending" || escrow.payment_method !== "crypto") return
    const interval = setInterval(() => { checkPaymentStatus() }, 5000)
    return () => clearInterval(interval)
  }, [escrow, user])

  // Handle PayPal return/cancel callbacks
  useEffect(() => {
    if (!escrow || escrow.payment_method !== "paypal" || !searchParams) return
    const ppStatus = searchParams.get("paypal")
    const token = searchParams.get("token")
    if (!ppStatus) return
    if (ppStatus === "success" && token && escrow.status === "pending") {
      const authorize = async () => {
        try {
          setPaypalProcessing(true)
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error("Not authenticated")
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow.id}/paypal-authorize`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token })
          })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j.error || "Failed to authorize PayPal payment")
          }
          const result = await res.json()
          setEscrow(result.escrow || result)
          setPaypalMessage("✅ PayPal authorization completed. Escrow funded.")
        } catch (e: any) {
          setPaypalMessage(e.message || "Failed to finalize PayPal authorization")
        } finally {
          setPaypalProcessing(false)
        }
      }
      authorize()
    } else if (ppStatus === "cancel") {
      setPaypalMessage("Payment cancelled on PayPal.")
    }
  }, [escrow, searchParams])

  const startPaypalCheckout = async () => {
    if (!escrow) return
    try {
      setPaypalProcessing(true)
      setPaypalMessage("")
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow.id}/paypal-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Failed to create PayPal order")
      }
      const data = await res.json()
      const url = data.approval_url
      if (!url) throw new Error("Missing PayPal approval URL")
      window.location.href = url
    } catch (e: any) {
      setPaypalMessage(e.message || "Failed to start PayPal checkout")
    } finally {
      setPaypalProcessing(false)
    }
  }

  const fetchEscrowDetails = async () => {
    if (!escrowId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : '')
      if (!apiBase) throw new Error('Missing NEXT_PUBLIC_API_URL for API requests')
      const res = await fetch(`${apiBase}/api/escrows/${escrowId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || !contentType.includes('application/json')) {
        const text = await res.text()
        throw new Error('Unexpected response from API. Please set NEXT_PUBLIC_API_URL to your Flask backend. Received: ' + text.slice(0, 100))
      }
      const data = await res.json()
      setEscrow(data)
      setBuyerProfile((data as any).buyer_profile || null)
      setSellerProfile((data as any).seller_profile || null)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setEscrowLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow!.id}/check-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        const result = await response.json()
        if (result.status === "funded" && result.confirmations >= 3) {
          setEscrow(result.escrow)
          setPaymentMessage("Payment confirmed with sufficient confirmations!")
        }
      }
    } catch (error) {
      console.error("Error checking payment:", error)
    }
  }

  const handleCheckPayment = async () => {
    setCheckingPayment(true)
    setPaymentMessage("")
    setError("")
    try { await checkPaymentStatus() } finally { setCheckingPayment(false) }
  }

  const handleActionSelect = async (action: "release" | "cancel") => {
    if (!escrow || !user) return
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update action")
      }
      const updatedEscrow = await response.json()
      setEscrow(updatedEscrow)
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleDeselect = async () => {
    if (!escrow || !user) return
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")
      const isBuyer = escrow.buyer_id === user.id
      const updateData = isBuyer ? { buyer_action: null } : { seller_action: null }
      const { error } = await supabase.from("escrows").update(updateData).eq("id", escrow.id)
      if (error) throw error
      setEscrow((prev) => (prev ? { ...prev, ...updateData } : null))
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handlePriceChange = async () => {
    if (!escrow || !user || !newPrice) return
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")
      const { error: updateError } = await supabase
        .from("escrows")
        .update({ amount: newPrice, status: "pending" })
        .eq("id", escrow.id)
      if (updateError) throw updateError

      await supabase.from("escrow_messages").insert({
        escrow_id: escrow.id,
        sender_id: user.id,
        message: `Buyer has proposed a new price: ${newPrice} ${escrow.currency}. Waiting for seller approval.`,
        message_type: "price_change_proposal",
      })

      setShowPriceChange(false)
      setNewPrice("")
      fetchEscrowDetails()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleSellerAddressSubmit = (address: string) => {
    setEscrow((prev) => (prev ? { ...prev, seller_address: address } : null))
  }

  const handleAmountConfirmed = () => {
    setEscrow((prev) => (prev ? { ...prev, seller_amount_confirmed: true } : null))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
      case "funded": return "bg-blue-500/20 text-blue-300 border-blue-400/30"
      case "confirmed": return "bg-purple-500/20 text-purple-300 border-purple-400/30"
      case "completed": return "bg-green-500/20 text-green-300 border-green-400/30"
      case "disputed": return "bg-red-500/20 text-red-300 border-red-400/30"
      case "cancelled": return "bg-gray-500/20 text-gray-300 border-gray-400/30"
      case "refunded": return "bg-orange-500/20 text-orange-300 border-orange-400/30"
      default: return "bg-gray-500/20 text-gray-300 border-gray-400/30"
    }
  }

  const canSelectActions = () => {
    if (!escrow || !user) return false
    const isBuyer = escrow.buyer_id === user.id
    const isSeller = escrow.seller_id === user.id
    if (!isBuyer && !isSeller) return false
    if (escrow.status !== "funded") return false
    return true
  }

  const getUserAction = () => {
    if (!escrow || !user) return null
    const isBuyer = escrow.buyer_id === user.id
    return isBuyer ? escrow.buyer_action : escrow.seller_action
  }

  const getOtherUserAction = () => {
    if (!escrow || !user) return null
    const isBuyer = escrow.buyer_id === user.id
    return isBuyer ? escrow.seller_action : escrow.buyer_action
  }

  const getBothPartiesStatus = () => {
    if (!escrow) return null
    const buyerAction = escrow.buyer_action
    const sellerAction = escrow.seller_action
    if (buyerAction && sellerAction && buyerAction === sellerAction) {
      return {
        agreed: true,
        action: buyerAction,
        message: buyerAction === "release"
          ? "Both parties agreed to release funds!"
          : "Both parties agreed to cancel the transaction!",
      }
    }
    if (buyerAction || sellerAction) {
      return { agreed: false, action: null, message: "Waiting for both parties to select the same action..." }
    }
    return null
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setPaymentMessage("Address copied to clipboard!")
      setTimeout(() => setPaymentMessage(""), 3000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl motion-safe:animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl motion-safe:animate-float-slow-reverse"></div>
        <div className="flex items-center space-x-3 text-white relative z-10 animate-fade-in">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full motion-safe:animate-spin"></div>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  if (escrowLoading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl motion-safe:animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl motion-safe:animate-float-slow-reverse"></div>
        <div className="flex items-center space-x-3 text-white relative z-10 animate-fade-in">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full motion-safe:animate-spin"></div>
          <span className="text-lg">Loading escrow details...</span>
        </div>
      </div>
    )
  }

  if (error && !escrow) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl motion-safe:animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl motion-safe:animate-float-slow-reverse"></div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 text-center max-w-md shadow-2xl shadow-orange-500/10 relative z-10 animate-fade-in-up">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-600/5 rounded-3xl"></div>
          <div className="relative z-10">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Error Loading Escrow</h2>
            <div className="backdrop-blur-sm bg-red-500/10 border border-red-400/20 text-red-300 px-4 py-3 rounded-2xl mb-6">
              {error}
            </div>
            <AnimatedBackButton onClick={() => router.push("/dashboard")} text="Back to Dashboard" className="bg-[#FF7A00] hover:bg-[#FF7A00] text-white px-6 py-3 rounded-lg font-medium transition-all duration-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!escrow) return null

  const isBuyer = user?.id === escrow.buyer_id
  const isSeller = user?.id === escrow.seller_id
  const userAction = getUserAction()
  const otherUserAction = getOtherUserAction()
  const bothPartiesStatus = getBothPartiesStatus()

  return (
    <div className="min-h-screen bg-black relative overflow-hidden text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl motion-safe:animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl motion-safe:animate-float-slow-reverse"></div>

      <div className="container mx-auto px-4 py-6 sm:py-8 pb-[max(2rem,env(safe-area-inset-bottom))] relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 sm:mb-8 animate-slide-in-down">
            <div className="flex items-center space-x-3 mb-4">
              <AnimatedBackButton onClick={() => router.push("/dashboard")} text="Back to Dashboard" />
            </div>
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  Escrow #{escrow.id.slice(0, 8)}
                  <span className="text-orange-400">.</span>
                </h1>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <p className="text-gray-400">Created on {new Date(escrow.created_at).toLocaleDateString()}</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full motion-safe:animate-glow-gentle"></div>
                    <span className="text-sm text-gray-400">
                      {isBuyer ? "You are the buyer" : isSeller ? "You are the seller" : "Observer"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-6">
              {showPriceChange && isBuyer && (
                <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-400/20 rounded-3xl p-6 shadow-xl shadow-blue-500/10 animate-slide-in-up">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/5 rounded-3xl"></div>
                  <div className="relative z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                      <span>💰</span>
                      <span>Propose New Price</span>
                    </h2>
                    <div className="space-y-4">
                      <div className="backdrop-blur-sm bg-blue-500/10 border border-blue-400/20 rounded-2xl p-4">
                        <p className="text-blue-200/80 flex items-start space-x-2">
                          <span className="text-blue-400 mt-0.5">ℹ️</span>
                          <span>
                            The seller has declined the current price of {escrow.amount} {escrow.currency}. You can
                            propose a new price below.
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          New Amount ({escrow.currency})
                        </label>
                        <input
                          type="number"
                          step="0.00000001"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                          placeholder={`Current: ${escrow.amount}`}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setShowPriceChange(false)
                            setNewPrice("")
                          }}
                          className="backdrop-blur-sm bg-gray-500/20 hover:bg-gray-500/30 border border-gray-400/30 hover:border-gray-400/50 text-white font-medium py-3 px-4 rounded-2xl transition-all duration-300 md:hover:scale-105 active:scale-[0.99] transform ease-out"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handlePriceChange}
                          disabled={!newPrice || Number.parseFloat(newPrice) <= 0}
                          className="backdrop-blur-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed md:hover:scale-105 active:scale-[0.99] transform ease-out shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
                        >
                          Propose New Price
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-slide-in-left">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

                <div className="relative z-10">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                    <span>📊</span>
                    <span>Status</span>
                  </h2>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm md:hover:scale-105 transition-transform duration-300 ${getStatusColor(
                        escrow.status,
                      )} inline-flex items-center space-x-2 w-fit`}
                    >
                      <span>{escrow.status.toUpperCase()}</span>
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${escrow.buyer_confirmed ? "bg-green-500 shadow-lg shadow-green-500/50 motion-safe:animate-glow-gentle" : "bg-gray-600"}`}></div>
                        <span className="text-gray-300">Buyer Confirmed</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${escrow.seller_confirmed ? "bg-green-500 shadow-lg shadow-green-500/50 motion-safe:animate-glow-gentle" : "bg-gray-600"}`}></div>
                        <span className="text-gray-300">Seller Confirmed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-slide-in-right" style={{ animationDelay: "0.1s" }}>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>
                <div className="relative z-10">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                    <span>💰</span>
                    <span>Transaction Details</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-1 min-w-0">
                      <p className="text-gray-400 text-sm">
                        Buyer{isBuyer && <span className="text-orange-400 text-xs font-normal ml-2">(You)</span>}
                      </p>
                      <p className="text-white text-lg font-medium min-w-0 max-w-full whitespace-pre-wrap break-words leading-relaxed overflow-hidden">
                        {buyerProfile?.username || "Loading..."}
                      </p>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-gray-400 text-sm">
                        Seller{isSeller && <span className="text-orange-400 text-xs font-normal ml-2">(You)</span>}
                      </p>
                      <p className="text-white text-lg font-medium min-w-0 max-w-full whitespace-pre-wrap break-words leading-relaxed overflow-hidden">
                        {sellerProfile?.username || "Loading..."}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-sm">Amount</p>
                      <p className="text-white text-2xl font-bold">
                        {escrow.amount} {escrow.currency}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-sm">Payment Method</p>
                      <p className="text-white text-lg font-medium capitalize flex items-center space-x-2">
                        <span>{escrow.payment_method === 'paypal' ? '💳' : '₿'}</span>
                        <span>{escrow.payment_method === 'paypal' ? 'PayPal' : 'Cryptocurrency'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {escrow.status === "pending" && isBuyer && escrow.payment_method === "crypto" && (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-slide-in-up" style={{ animationDelay: "0.2s" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

                  <div className="relative z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                      <span>💳</span>
                      <span>Payment Information</span>
                    </h2>
                    {escrow.deposit_address ? (
                      <div className="space-y-4">
                        <p className="text-gray-400">
                          Send <span className="text-orange-400 font-semibold">{escrow.amount} {escrow.currency}</span> to this address:
                        </p>
                        <div className="backdrop-blur-sm bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 relative">
                          <div className="break-all font-mono text-orange-400 text-sm pr-12">
                            {escrow.deposit_address}
                          </div>
                          <button
                            onClick={() => copyToClipboard(escrow.deposit_address!)}
                            className="absolute top-3 right-3 text-gray-300 md:text-gray-400 hover:text-orange-400 transition-colors duration-200 opacity-100 md:opacity-0 md:hover:opacity-100 md:group-hover:opacity-100 md:hover:scale-110 transform ease-out"
                            title="Copy address"
                            aria-label="Copy address"
                          >
                            📋
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="text-xs text-gray-500">
                            Waiting for confirmations... ({escrow.confirmations || 0}/3)
                          </p>
                          <button
                            onClick={handleCheckPayment}
                            disabled={checkingPayment}
                            className="w-full sm:w-auto text-center backdrop-blur-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 disabled:opacity-50 md:hover:scale-105 active:scale-[0.99] transform ease-out shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
                          >
                            {checkingPayment ? "Checking..." : "Check Payment"}
                          </button>
                        </div>
                        {paymentMessage && (
                          <div className={`px-4 py-3 rounded-2xl text-sm backdrop-blur-sm animate-slide-in-up ${
                            paymentMessage.includes("confirmed") || paymentMessage.includes("copied")
                              ? "bg-green-500/10 border border-green-400/20 text-green-300"
                              : "bg-blue-500/10 border border-blue-400/20 text-blue-300"
                          }`}>
                            <div className="flex items-center space-x-2">
                              <span>{paymentMessage.includes("confirmed") ? "✅" : "ℹ️"}</span>
                              <span>{paymentMessage}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3 text-gray-400">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full motion-safe:animate-spin"></div>
                        <span>Generating payment address...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {escrow.status === "pending" && isBuyer && escrow.payment_method === "paypal" && (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-slide-in-up" style={{ animationDelay: "0.2s" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

                  <div className="relative z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                      <span>💳</span>
                      <span>Pay with PayPal</span>
                    </h2>
                    <p className="text-gray-300 mb-4">
                      You will be redirected to PayPal to authorize a hold of ${'{'}escrow.amount{'}'} USD. Funds are not captured until release.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <button
                        onClick={startPaypalCheckout}
                        disabled={paypalProcessing}
                        className="w-full sm:w-auto text-center backdrop-blur-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-50 md:hover:scale-105 active:scale-[0.99] transform ease-out shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20"
                      >
                        {paypalProcessing ? "Opening PayPal..." : "Continue to PayPal"}
                      </button>
                      {paypalMessage && (
                        <span className="text-sm text-blue-300">{paypalMessage}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {canSelectActions() && (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-slide-in-up" style={{ animationDelay: "0.3s" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

                  <div className="relative z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center space-x-2">
                      <span>⚡</span>
                      <span>Actions</span>
                    </h2>
                    <div className="space-y-4">
                      <div className="backdrop-blur-sm bg-orange-500/10 border border-orange-400/20 rounded-2xl p-4">
                        <p className="text-orange-200/80 flex items-start space-x-2">
                          <span className="text-orange-400 mt-0.5">ℹ️</span>
                          <span>
                            {isBuyer
                              ? "Please select your action once you have received the goods or services from the seller."
                              : "Please select your action once you have delivered the goods or services to the buyer."}
                          </span>
                        </p>
                      </div>

                      {bothPartiesStatus && (
                        <div className={`rounded-2xl p-4 backdrop-blur-sm animate-slide-in-up ${
                          bothPartiesStatus.agreed
                            ? bothPartiesStatus.action === "release"
                              ? "bg-green-500/10 border border-green-400/20"
                              : "bg-red-500/10 border border-red-400/20"
                            : "bg-blue-500/10 border border-blue-400/20"
                        }`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <span>
                              {bothPartiesStatus.agreed ? (bothPartiesStatus.action === "release" ? "✅" : "❌") : "⏳"}
                            </span>
                            <span className={`font-semibold ${
                              bothPartiesStatus.agreed
                                ? bothPartiesStatus.action === "release" ? "text-green-300" : "text-red-300"
                                : "text-blue-300"
                            }`}>
                              {bothPartiesStatus.message}
                            </span>
                          </div>
                          {!bothPartiesStatus.agreed && (
                            <div className="text-sm opacity-80">
                              <p>Your choice: {userAction ? (userAction === "release" ? "✅ Release" : "❌ Cancel") : "None"}</p>
                              <p>Other party: {otherUserAction ? (otherUserAction === "release" ? "✅ Release" : "❌ Cancel") : "None"}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {error && (
                        <div className="backdrop-blur-sm bg-red-500/10 border border-red-400/20 text-red-300 px-4 py-3 rounded-2xl text-sm animate-shake">
                          <div className="flex items-center space-x-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => handleActionSelect("cancel")}
                            className={`font-semibold py-4 px-6 rounded-2xl transition-all duration-300 md:hover:scale-105 active:scale-[0.99] transform ease-out ${
                              userAction === "cancel"
                                ? "bg-red-500/30 text-white border-2 border-red-400/50 shadow-lg shadow-red-500/25"
                                : "backdrop-blur-sm bg-red-500/10 text-red-300 border-2 border-red-500/30 hover:bg-red-500/20 hover:border-red-400/50"
                            }`}
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <span>❌</span>
                              <span>Cancel Transaction</span>
                              {userAction === "cancel" && <span className="text-xs">(Selected)</span>}
                            </div>
                          </button>
                          <button
                            onClick={() => handleActionSelect("release")}
                            className={`font-semibold py-4 px-6 rounded-2xl transition-all duration-300 md:hover:scale-105 active:scale-[0.99] transform ease-out ${
                              userAction === "release"
                                ? "bg-green-500/30 text-white border-2 border-green-400/50 shadow-lg shadow-green-500/25"
                                : "backdrop-blur-sm bg-green-500/10 text-green-300 border-2 border-green-500/30 hover:bg-green-500/20 hover:border-green-400/50"
                            }`}
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <span>✅</span>
                              <span>Release Funds</span>
                              {userAction === "release" && <span className="text-xs">(Selected)</span>}
                            </div>
                          </button>
                        </div>

                        {userAction && (
                          <button
                            onClick={handleDeselect}
                            className="w-full backdrop-blur-sm bg-gray-500/10 text-gray-300 border-2 border-gray-500/30 hover:bg-gray-500/20 hover:border-gray-400/50 font-medium py-3 px-4 rounded-2xl transition-all duration-300 md:hover:scale-105 active:scale-[0.99] transform ease-out"
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <span>↩️</span>
                              <span>Deselect Choice</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {escrow.status === "completed" && (
                <div className="backdrop-blur-xl bg-green-500/10 border border-green-400/20 rounded-3xl p-6 shadow-xl shadow-green-500/10 animate-slide-in-up" style={{ animationDelay: "0.4s" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-green-600/5 rounded-3xl"></div>
                  <div className="relative z-10">
                    <div className="text-center">
                      <div className="text-green-400 text-6xl mb-4 motion-safe:animate-bounce-gentle">✅</div>
                      <h2 className="text-2xl font-bold text-green-300 mb-3">Transaction Completed!</h2>
                      <p className="text-green-200/80 max-w-md mx-auto">
                        This escrow has been successfully completed. Both parties have confirmed the transaction and
                        funds have been released.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {escrow.status === "refunded" && (
                <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-400/20 rounded-3xl p-6 shadow-xl shadow-orange-500/10 animate-slide-in-up" style={{ animationDelay: "0.4s" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
                  <div className="relative z-10">
                    <div className="text-center">
                      <div className="text-orange-400 text-6xl mb-4 motion-safe:animate-bounce-gentle">🔄</div>
                      <h2 className="text-2xl font-bold text-orange-300 mb-3">Transaction Refunded!</h2>
                      <p className="text-orange-200/80 max-w-md mx-auto">
                        This escrow was cancelled and the funds have been refunded to the buyer.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
              {escrow && user && buyerProfile && sellerProfile && (
                <EscrowChat
                  escrow={escrow}
                  currentUserId={user.id}
                  buyerProfile={buyerProfile}
                  sellerProfile={sellerProfile}
                  onSellerAddressSubmit={handleSellerAddressSubmit}
                  onAmountConfirmed={handleAmountConfirmed}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}