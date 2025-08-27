"use client"

import { Escrow } from "@/lib/types"
import { useState, useEffect } from "react"

interface TransactionOverlayProps {
  escrow: Escrow
  buyerProfile: any
  sellerProfile: any
  currentUserId: string
  onClose: () => void
}

export default function TransactionOverlay({ 
  escrow, 
  buyerProfile, 
  sellerProfile,
  currentUserId,
  onClose 
}: TransactionOverlayProps) {
  const [isVisible, setIsVisible] = useState(false)

  const isBuyer = currentUserId === escrow.buyer_id
  const isSeller = currentUserId === escrow.seller_id

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-700"
      case "funded":
        return "bg-blue-900/50 text-blue-300 border-blue-700"
      case "confirmed":
        return "bg-purple-900/50 text-purple-300 border-purple-700"
      case "completed":
        return "bg-green-900/50 text-green-300 border-green-700"
      case "disputed":
        return "bg-red-900/50 text-red-300 border-red-700"
      case "cancelled":
        return "bg-gray-900/50 text-gray-300 border-gray-700"
      case "refunded":
        return "bg-orange-900/50 text-orange-300 border-orange-700"
      default:
        return "bg-gray-900/50 text-gray-300 border-gray-700"
    }
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-start justify-center pt-20 transition-all duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      <div 
        className={`relative bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 transition-all duration-300 ${
          isVisible ? "translate-y-0 scale-100" : "-translate-y-10 scale-95"
        }`}
      >
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <span>💰</span>
            <span>Transaction Details</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-gray-400 text-sm">Amount</p>
              <p className="text-white text-2xl font-bold">
                {escrow.amount} {escrow.currency}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-gray-400 text-sm">Payment Method</p>
              <p className="text-white text-lg font-medium capitalize flex items-center space-x-2">
                <span>{escrow.payment_method === "crypto" ? "₿" : "💳"}</span>
                <span>{escrow.payment_method}</span>
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-gray-400 text-sm">Buyer</p>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#FF7A00] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">B</span>
                </div>
                <p className="text-white text-lg font-medium">
                  {buyerProfile?.username || "Loading..."}
                  {isBuyer && <span className="text-orange-400 text-sm font-normal ml-2"></span>}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-gray-400 text-sm">Seller</p>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#FF7A00] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <p className="text-white text-lg font-medium">
                  {sellerProfile?.username || "Loading..."}
                  {isSeller && <span className="text-orange-400 text-sm font-normal ml-2"></span>}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="mt-6 pt-6 border-t border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Status</p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(escrow.status)}`}>
                {escrow.status.toUpperCase()}
              </span>
            </div>

            {escrow.payment_method === "crypto" && (
              <div className="flex justify-between items-center">
                <p className="text-gray-400 text-sm">Confirmations</p>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-800 rounded-full h-2">
                    <div 
                      className="bg-[#FF7A00] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((escrow.confirmations || 0) * 33.33, 100)}%` }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium">
                    {escrow.confirmations || 0}/3
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Escrow ID</p>
              <p className="text-white font-mono text-xs">
                #{escrow.id.slice(0, 8)}
              </p>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Created</p>
              <p className="text-white text-sm">
                {new Date(escrow.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}