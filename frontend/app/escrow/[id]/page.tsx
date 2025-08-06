"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"

// Force dynamic rendering to prevent prerender errors
export const dynamic = 'force-dynamic'

function PayPalSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [processing, setProcessing] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const handlePayPalReturn = async () => {
      const token = searchParams.get('token')
      const PayerID = searchParams.get('PayerID')
      
      if (!token) {
        setError("Missing PayPal token")
        setProcessing(false)
        return
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/auth')
          return
        }

        // Find the escrow with this PayPal order ID
        const { data: escrows, error: fetchError } = await supabase
          .from('escrows')
          .select('*')
          .eq('paypal_order_id', token)
          .single()

        if (fetchError || !escrows) {
          setError("Escrow not found")
          setProcessing(false)
          return
        }

        // Process the authorization
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/escrows/${escrows.id}/paypal-authorize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token, PayerID })
        })

        if (response.ok) {
          const result = await response.json()
          // Redirect to escrow page
          router.push(`/escrow/${escrows.id}`)
        } else {
          const errorData = await response.json()
          setError(errorData.error || "Failed to process payment")
        }
      } catch (error) {
        console.error('PayPal processing error:', error)
        setError("Payment processing failed")
      } finally {
        setProcessing(false)
      }
    }

    handlePayPalReturn()
  }, [searchParams, router])

  if (processing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Processing PayPal Payment...</h2>
          <p className="text-gray-400">Please wait while we secure your funds in escrow.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-400">Payment Failed</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default function PayPalSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    }>
      <PayPalSuccessContent />
    </Suspense>
  )
}
