"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Escrow } from "@/lib/types"

interface EscrowChatProps {
  escrow: Escrow
  currentUserId: string
  buyerProfile: any
  sellerProfile: any
  onSellerAddressSubmit: (address: string) => void
  onAmountConfirmed: () => void
  onSellerPaypalEmailSubmit?: (email: string) => void // new optional prop
}

export default function EscrowChat({
  escrow,
  currentUserId,
  buyerProfile,
  sellerProfile,
  onSellerAddressSubmit,
  onAmountConfirmed,
  onSellerPaypalEmailSubmit,
}: EscrowChatProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sellerAddress, setSellerAddress] = useState("")
  const [showAddressInput, setShowAddressInput] = useState(false)
  const [buyerAddress, setBuyerAddress] = useState("")
  const [showBuyerAddressInput, setShowBuyerAddressInput] = useState(false)
  const [processingRefund, setProcessingRefund] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const [sellerPaypalEmail, setSellerPaypalEmail] = useState("")
  const [paypalEmailLoading, setPaypalEmailLoading] = useState(false)

  const isBuyer = currentUserId === escrow.buyer_id
  const isSeller = currentUserId === escrow.seller_id

  useEffect(() => {
    fetchMessages()

    // Enhanced real-time subscription with better error handling
    const channel = supabase
      .channel(`escrow-messages-${escrow.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: currentUserId }
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "escrow_messages",
          filter: `escrow_id=eq.${escrow.id}`,
        },
        (payload) => {
          console.log('New message received:', payload.new)
          setMessages((prevMessages) => {
            // Check if message already exists to prevent duplicates
            const messageExists = prevMessages.some(msg => msg.id === payload.new.id)
            if (messageExists) {
              return prevMessages
            }
            return [...prevMessages, payload.new]
          })
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrow_messages",
          filter: `escrow_id=eq.${escrow.id}`,
        },
        (payload) => {
          console.log('Message updated:', payload.new)
          setMessages((prevMessages) => 
            prevMessages.map(msg => 
              msg.id === payload.new.id ? payload.new : msg
            )
          )
        },
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates')
        }
      })

    // Initial setup messages
    if (isSeller && !escrow.seller_address && escrow.payment_method === "crypto") {
      addSystemMessage("Please provide your crypto address to receive funds when the escrow is completed.")
      setShowAddressInput(true)
    }

    if (isSeller && !escrow.seller_amount_confirmed) {
      addSystemMessage(`Please confirm the escrow amount: ${escrow.amount} ${escrow.currency}`)
    }

    return () => {
      console.log('Unsubscribing from channel')
      channel.unsubscribe()
    }
  }, [escrow.id, currentUserId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Handle cancelled escrow refund address
  useEffect(() => {
    if (
      escrow?.status === "cancelled" &&
      currentUserId === escrow.buyer_id &&
      !escrow.buyer_refund_address &&
      escrow.payment_method === "crypto"
    ) {
      addSystemMessage("Transaction was cancelled. Please provide your crypto address to receive the refund.")
      setShowBuyerAddressInput(true)
    }
  }, [escrow?.status, currentUserId, escrow?.buyer_id, escrow?.buyer_refund_address, escrow?.payment_method])

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("escrow_messages")
        .select("*")
        .eq("escrow_id", escrow.id)
        .order("created_at", { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      } else {
        setMessages(data || [])
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error)
    } finally {
      setLoading(false)
    }
  }

  const addSystemMessage = async (text: string) => {
    try {
      const { data, error } = await supabase.from("escrow_messages").insert({
        escrow_id: escrow.id,
        sender_id: currentUserId,
        message: text,
        message_type: "system",
      }).select()

      if (error) {
        console.error('Error adding system message:', error)
      } else {
        console.log('System message added:', data)
      }
    } catch (error) {
      console.error('Error in addSystemMessage:', error)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const messageText = newMessage.trim()
    setNewMessage("") // Clear input immediately for better UX

    try {
      const { data, error } = await supabase.from("escrow_messages").insert({
        escrow_id: escrow.id,
        sender_id: currentUserId,
        message: messageText,
        message_type: "text",
      }).select()

      if (error) {
        console.error('Error sending message:', error)
        // Restore message if failed
        setNewMessage(messageText)
      } else {
        console.log('Message sent successfully:', data)
      }
    } catch (error) {
      console.error('Error in sendMessage:', error)
      // Restore message if failed
      setNewMessage(messageText)
    }
  }

  const handleAddressSubmit = async () => {
    if (!sellerAddress.trim()) return

    try {
      const { error } = await supabase.from("escrows").update({ seller_address: sellerAddress }).eq("id", escrow.id)

      if (!error) {
        await supabase.from("escrow_messages").insert({
          escrow_id: escrow.id,
          sender_id: currentUserId,
          message: `Payout address set: ${sellerAddress}`,
          message_type: "address_response",
          metadata: { address: sellerAddress },
        })

        setShowAddressInput(false)
        onSellerAddressSubmit(sellerAddress)
      }
    } catch (error) {
      console.error('Error submitting address:', error)
    }
  }

  const handleAmountConfirmation = async () => {
    try {
      const { error } = await supabase.from("escrows").update({ seller_amount_confirmed: true }).eq("id", escrow.id)

      if (!error) {
        await supabase.from("escrow_messages").insert({
          escrow_id: escrow.id,
          sender_id: currentUserId,
          message: `Amount confirmed: ${escrow.amount} ${escrow.currency}`,
          message_type: "amount_confirmation",
        })

        onAmountConfirmed()
      }
    } catch (error) {
      console.error('Error confirming amount:', error)
    }
  }

  const handleBuyerAddressSubmit = async () => {
    if (!buyerAddress.trim()) return

    try {
      const { error } = await supabase
        .from("escrows")
        .update({
          buyer_refund_address: buyerAddress,
        })
        .eq("id", escrow.id)

      if (!error) {
        await supabase.from("escrow_messages").insert({
          escrow_id: escrow.id,
          sender_id: currentUserId,
          message: `Refund address set: ${buyerAddress}`,
          message_type: "refund_address_response",
          metadata: { address: buyerAddress },
        })

        setShowBuyerAddressInput(false)
      }
    } catch (error) {
      console.error('Error submitting buyer address:', error)
    }
  }

  const handleProcessRefund = async () => {
    if (!buyerAddress.trim()) {
      alert("Please enter your refund address first")
      return
    }

    setProcessingRefund(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("Not authenticated")
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow.id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          refund_address: buyerAddress,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process refund")
      }

      const result = await response.json()

      await supabase.from("escrow_messages").insert({
        escrow_id: escrow.id,
        sender_id: currentUserId,
        message: `🔄 Refund request submitted. ${result.transaction_hash ? `Transaction: ${result.transaction_hash}` : ""}`,
        message_type: "system",
      })

      setShowBuyerAddressInput(false)
      setBuyerAddress("")
    } catch (error: any) {
      console.error("Refund error:", error)
      alert(`Refund failed: ${error.message}`)
    } finally {
      setProcessingRefund(false)
    }
  }

  const handlePaypalEmailSubmit = async () => {
    try {
      setPaypalEmailLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrow.id}/paypal-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ paypal_email: sellerPaypalEmail })
      })
      if (response.ok) {
        onSellerPaypalEmailSubmit?.(sellerPaypalEmail)
        setSellerPaypalEmail("")
      }
    } catch (error) {
      console.error("Error saving PayPal email:", error)
    } finally {
      setPaypalEmailLoading(false)
    }
  }

  const getSenderName = (senderId: string) => {
    if (senderId === escrow.buyer_id) return buyerProfile?.username || "Buyer"
    if (senderId === escrow.seller_id) return sellerProfile?.username || "Seller"
    return "System"
  }

  const getSenderAvatar = (senderId: string) => {
    let email = ""
    let bgGradient = ""
    let borderColor = ""
    let shadowColor = ""

    if (senderId === escrow.buyer_id) {
      email = buyerProfile?.email || buyerProfile?.username || "B"
      bgGradient = "from-blue-500/20 to-blue-600/20"
      borderColor = "border-blue-400/30"
      shadowColor = "shadow-blue-500/20"
    } else if (senderId === escrow.seller_id) {
      email = sellerProfile?.email || sellerProfile?.username || "S"
      bgGradient = "from-orange-500/20 to-amber-500/20"
      borderColor = "border-orange-400/30"
      shadowColor = "shadow-orange-500/20"
    } else {
      email = "System"
      bgGradient = "from-gray-500/20 to-gray-600/20"
      borderColor = "border-gray-400/30"
      shadowColor = "shadow-gray-500/20"
    }

    const firstLetter = email.charAt(0).toUpperCase()

    return (
      <div
        className={`w-10 h-10 bg-gradient-to-br ${bgGradient} backdrop-blur-sm border ${borderColor} rounded-full flex items-center justify-center shadow-lg ${shadowColor} hover:scale-110 transition-all duration-300`}
      >
        <span
          className={`font-bold text-sm ${senderId === escrow.buyer_id ? "text-blue-400" : senderId === escrow.seller_id ? "text-orange-400" : "text-gray-400"}`}
        >
          {firstLetter}
        </span>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl shadow-orange-500/10 hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-fade-in-up">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

      <div className="relative z-10">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
          <span>💬</span>
          <span>Messages</span>
          <div className="ml-auto flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-glow-gentle"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </h2>

        <div
          ref={chatRef}
          className="h-96 overflow-y-auto backdrop-blur-sm bg-black/30 border border-white/10 rounded-2xl p-4 mb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:border-white/20 transition-colors duration-300"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading messages...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="text-gray-400 mb-2">No messages yet</div>
              <div className="text-sm text-gray-500">Start the conversation to coordinate your escrow transaction</div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isCurrentUser = msg.sender_id === currentUserId
              const isSystem = msg.message_type === "system"

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center animate-slide-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                                       <div className="backdrop-blur-sm bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-400/20 text-orange-300 px-4 py-3 rounded-2xl text-sm max-w-md text-center hover:bg-orange-500/15 transition-all duration-300 shadow-lg shadow-orange-500/10">
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-orange-400">🤖</span>
                        <span>{msg.message}</span>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"} animate-slide-in-up`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className={`flex items-end gap-4 max-w-xs lg:max-w-md ${
                      isCurrentUser ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!isCurrentUser && <div className="flex-shrink-0">{getSenderAvatar(msg.sender_id)}</div>}
                    <div className={`${isCurrentUser ? "order-2" : ""} flex flex-col space-y-1`}>
                      <div className={`text-xs text-gray-400 px-2 ${isCurrentUser ? "text-right" : "text-left"}`}>
                        {getSenderName(msg.sender_id)} • {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] transform ease-out relative overflow-hidden ${
                          isCurrentUser
                            ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/30 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
                            : "bg-gradient-to-r from-white/10 to-white/5 text-gray-200 border border-white/20 hover:bg-white/15 hover:border-white/30 shadow-lg shadow-white/5"
                        } ${isCurrentUser ? "rounded-br-md" : "rounded-bl-md"}`}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${
                            isCurrentUser ? "from-orange-400/10 to-amber-400/10" : "from-white/5 to-white/10"
                          } opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-2xl`}
                        ></div>
                        <span className="relative z-10 font-medium">{msg.message}</span>
                      </div>
                    </div>
                    {isCurrentUser && <div className="flex-shrink-0">{getSenderAvatar(msg.sender_id)}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {isSeller && showAddressInput && escrow.payment_method === "crypto" && (
          <div className="mb-4 backdrop-blur-sm bg-orange-500/10 border border-orange-400/20 rounded-2xl p-4 animate-slide-in-up">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-orange-400">🏦</span>
              <p className="text-orange-300 text-sm font-medium">
                Enter your {escrow.currency} address to receive funds:
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={sellerAddress}
                onChange={(e) => setSellerAddress(e.target.value)}
                className="flex-1 px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                placeholder={`Your ${escrow.currency} address`}
              />
              <button
                onClick={handleAddressSubmit}
                className="backdrop-blur-sm bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:scale-105 transform ease-out"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {currentUserId === escrow.buyer_id && showBuyerAddressInput && escrow.payment_method === "crypto" && (
          <div className="mb-4 backdrop-blur-sm bg-red-500/10 border border-red-400/20 rounded-2xl p-4 animate-slide-in-up">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-red-400">💸</span>
              <p className="text-red-300 text-sm font-medium">
                Enter your {escrow.currency} address to receive the refund:
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="flex-1 px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                  placeholder={`Your ${escrow.currency} refund address`}
                />
                <button
                  onClick={handleBuyerAddressSubmit}
                  className="backdrop-blur-sm bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 border border-red-400/30 hover:border-red-400/50 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg shadow-red-500/10 hover:shadow-red-500/20 hover:scale-105 transform ease-out"
                >
                  Submit
                </button>
              </div>

              {buyerAddress && (
                <button
                  onClick={handleProcessRefund}
                  disabled={processingRefund}
                  className="w-full backdrop-blur-sm bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-400/30 hover:border-red-400/50 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transform ease-out"
                >
                  {processingRefund ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      Processing Refund...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <span>🔄</span>
                      <span>Process Refund Now</span>
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {isSeller && !escrow.seller_amount_confirmed && (
          <div className="mb-4 backdrop-blur-sm bg-blue-500/10 border border-blue-400/20 rounded-2xl p-4 animate-slide-in-up">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-blue-400">💰</span>
              <p className="text-blue-300 text-sm font-medium">Please confirm the escrow amount:</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-lg">
                {escrow.amount} {escrow.currency}
              </span>
              <button
                onClick={handleAmountConfirmation}
                className="backdrop-blur-sm bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 border border-blue-400/30 hover:border-blue-400/50 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-300 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-105 transform ease-out"
              >
                ✓ Confirm Amount
              </button>
            </div>
          </div>
        )}

        {/* PayPal seller email prompt */}
        {escrow.payment_method === 'paypal' && isSeller && escrow.status === 'funded' && !escrow.seller_paypal_email && (
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-2xl p-4 mb-4 animate-slide-in-up">
            <h4 className="text-blue-300 font-semibold mb-2">PayPal Email Required</h4>
            <p className="text-blue-200/80 text-sm mb-3">
              Please provide your PayPal email address to receive funds when the buyer releases payment.
            </p>
            <div className="flex space-x-2">
              <input
                type="email"
                value={sellerPaypalEmail}
                onChange={(e) => setSellerPaypalEmail(e.target.value)}
                placeholder="your-paypal@email.com"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                disabled={paypalEmailLoading}
              />
              <button
                onClick={handlePaypalEmailSubmit}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white disabled:opacity-50"
                disabled={paypalEmailLoading || !sellerPaypalEmail.trim()}
              >
                {paypalEmailLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex gap-3 animate-slide-in-up">
          <div className="flex-1 relative group">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full px-4 py-4 backdrop-blur-sm bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12 hover:border-white/30 pr-12 shadow-lg shadow-white/5 hover:shadow-orange-500/10"
              placeholder="Type your message..."
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-orange-400 transition-colors duration-300">
              💬
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"></div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="backdrop-blur-sm bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-6 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 hover:scale-105 transform ease-out relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10">Send</span>
            <span className="relative z-10 group-hover:translate-x-1 transition-transform duration-300">→</span>
          </button>
        </form>
      </div>
    </div>
  )
}