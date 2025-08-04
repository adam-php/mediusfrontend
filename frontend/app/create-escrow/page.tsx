"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { Currency } from "@/lib/types"
import AnimatedBackButton from "@/components/animated-back-button"

export default function CreateEscrow() {
  const [user, setUser] = useState<any>(null)
  const [sellerUsername, setSellerUsername] = useState("")
  const [usdAmount, setUsdAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"crypto" | "paypal">("crypto")
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cryptoPrices, setCryptoPrices] = useState<{[key: string]: number}>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const router = useRouter()

  // Much more reasonable minimum USD amounts
  const minimumUsdAmounts = {
    BTC: 2,      // $2 (covers ~$1-2 fee)
    ETH: 3,      // $3 (covers gas fees)
    LTC: 0.50,   // $0.50 (LTC fees are very low)
    BCH: 0.50,   // $0.50 (BCH fees are low)
    DOGE: 1,     // $1 (DOGE fees are minimal)
    XRP: 0.25,   // $0.25 (XRP fees are tiny)
    ADA: 0.50,   // $0.50 (ADA fees are low)
    DOT: 1,      // $1 (DOT fees)
    MATIC: 0.25, // $0.25 (Polygon is cheap)
    SOL: 1,      // $1 (Solana fees)
    AVAX: 0.50,  // $0.50 (AVAX fees)
    TRX: 0.25,   // $0.25 (Tron is very cheap)
    BNB: 0.50,   // $0.50 (BSC fees)
    ATOM: 0.50,  // $0.50 (Cosmos fees)
    XLM: 0.10,   // $0.10 (Stellar is super cheap)
    USD: 1       // $1 minimum for PayPal
  }

  const getMinimumUsdAmount = () => {
    if (paymentMethod === "paypal") {
      return minimumUsdAmounts.USD
    }
    return minimumUsdAmounts[currency as keyof typeof minimumUsdAmounts] || 0.50
  }

  const getCryptoAmount = () => {
    if (paymentMethod === "paypal" || !usdAmount || !cryptoPrices[currency]) {
      return null
    }
    
    const usdValue = Number.parseFloat(usdAmount)
    const cryptoPrice = cryptoPrices[currency]
    const cryptoAmount = usdValue / cryptoPrice
    
    return cryptoAmount.toFixed(8)
  }

  const validateAmount = () => {
    const numAmount = Number.parseFloat(usdAmount)
    const minAmount = getMinimumUsdAmount()
    
    if (!usdAmount || numAmount <= 0) {
      return "Please enter an amount"
    }
    
    if (numAmount < minAmount) {
      if (paymentMethod === "paypal") {
        return `Minimum $${minAmount} USD for PayPal transactions`
      } else {
        return `Minimum $${minAmount} USD to cover ${currency} network fees`
      }
    }
    return null
  }

  const fetchCryptoPrices = async () => {
    setLoadingPrices(true)
    try {
      // Using CoinGecko API for real-time prices
      const cryptoIds = {
        BTC: 'bitcoin',
        ETH: 'ethereum', 
        LTC: 'litecoin',
        BCH: 'bitcoin-cash',
        DOGE: 'dogecoin',
        XRP: 'ripple',
        ADA: 'cardano',
        DOT: 'polkadot',
        MATIC: 'matic-network',
        SOL: 'solana',
        AVAX: 'avalanche-2',
        TRX: 'tron',
        BNB: 'binancecoin',
        ATOM: 'cosmos',
        XLM: 'stellar'
      }
      
      const ids = Object.values(cryptoIds).join(',')
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
      )
      
      if (!response.ok) throw new Error('Failed to fetch prices')
      
      const data = await response.json()
      
      // Convert back to our currency codes
      const prices: {[key: string]: number} = {}
      Object.entries(cryptoIds).forEach(([code, id]) => {
        if (data[id]?.usd) {
          prices[code] = data[id].usd
        }
      })
      
      setCryptoPrices(prices)
    } catch (error) {
      console.error('Error fetching crypto prices:', error)
      // Fallback prices if API fails
      setCryptoPrices({
        BTC: 45000,
        ETH: 2500,
        LTC: 70,
        BCH: 250,
        DOGE: 0.08,
        XRP: 0.6,
        ADA: 0.4,
        DOT: 4,
        MATIC: 0.4,
        SOL: 150,
        AVAX: 30,
        TRX: 0.1,
        BNB: 600,
        ATOM: 4,
        XLM: 0.1
      })
    } finally {
      setLoadingPrices(false)
    }
  }

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
    }

    const fetchCurrencies = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/supported-currencies")
        const data = await response.json()
        setCurrencies(data)
        if (data.length > 0) {
          setCurrency(data[0].code)
        }
      } catch (error) {
        console.error("Error fetching currencies:", error)
      }
    }

    checkUser()
    fetchCurrencies()
    fetchCryptoPrices()
    
    // Refresh prices every 30 seconds
    const priceInterval = setInterval(fetchCryptoPrices, 30000)
    return () => clearInterval(priceInterval)
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validate minimum amount
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      setLoading(false)
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("Not authenticated")
      }

      // Calculate the actual amount to send
      let finalAmount: number
      let finalCurrency: string

      if (paymentMethod === "paypal") {
        finalAmount = Number.parseFloat(usdAmount)
        finalCurrency = "USD"
      } else {
        const cryptoAmount = getCryptoAmount()
        if (!cryptoAmount) {
          throw new Error("Unable to calculate crypto amount")
        }
        finalAmount = Number.parseFloat(cryptoAmount)
        finalCurrency = currency
      }

      const response = await fetch("http://localhost:5000/api/escrows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          seller_username: sellerUsername,
          amount: finalAmount,
          currency: finalCurrency,
          payment_method: paymentMethod,
          usd_amount: Number.parseFloat(usdAmount), // Store USD amount for reference
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create escrow")
      }

      const escrow = await response.json()
      router.push(`/escrow/${escrow.id}`)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const cryptoAmount = getCryptoAmount()

  return (
    <div className="min-h-screen bg-black relative overflow-hidden text-white">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-float-slow-reverse"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-400/8 rounded-full blur-2xl animate-float-gentle"></div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 animate-slide-in-down">
            <div className="flex items-center space-x-3 mb-4">
              <AnimatedBackButton onClick={() => router.push("/dashboard")} text="Back to Dashboard" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Create New Escrow<span className="text-orange-400">.</span>
            </h1>
            <p className="text-gray-400">Set up a secure escrow transaction with our automatic middleman services</p>
            {user && (
              <div className="flex items-center mt-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-glow-gentle"></div>
                <span className="text-sm text-gray-400">Creating as {user.email}</span>
              </div>
            )}
          </div>

          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              <div className="animate-slide-in-left" style={{ animationDelay: "0.1s" }}>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  <span className="flex items-center space-x-2">
                    <span>👤</span>
                    <span>Seller email</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={sellerUsername}
                  onChange={(e) => setSellerUsername(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                  placeholder="Enter the seller's email"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">The email of the person you're trading with</p>
              </div>

              <div className="animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  <span className="flex items-center space-x-2">
                    <span>💳</span>
                    <span>Payment Method</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("crypto")}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ease-out hover:scale-105 transform ${
                      paymentMethod === "crypto"
                        ? "border-orange-500 bg-orange-500/10 text-orange-300 shadow-lg shadow-orange-500/20"
                        : "border-white/20 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3">₿</div>
                      <div className="font-semibold text-lg">Cryptocurrency</div>
                      <div className="text-xs text-gray-400 mt-2">Bitcoin, Ethereum, Litecoin, and more</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("paypal")}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 ease-out hover:scale-105 transform ${
                      paymentMethod === "paypal"
                        ? "border-orange-500 bg-orange-500/10 text-orange-300 shadow-lg shadow-orange-500/20"
                        : "border-white/20 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-3">💳</div>
                      <div className="font-semibold text-lg">PayPal</div>
                      <div className="text-xs text-gray-400 mt-2">Traditional payment</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="animate-slide-in-left" style={{ animationDelay: "0.3s" }}>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <span className="flex items-center space-x-2">
                      <span>💰</span>
                      <span>Amount (USD)</span>
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={usdAmount}
                    onChange={(e) => setUsdAmount(e.target.value)}
                    className="w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                    placeholder="0.00"
                    required
                  />
                  
                  <div className="mt-2">
                    {/* Show minimum amount and current price in same small style */}
                    <p className="text-xs text-gray-500">
                      Minimum: ${getMinimumUsdAmount()} USD (covers fees)
                    </p>
                    {paymentMethod === "crypto" && cryptoPrices[currency] && (
                      <p className="text-xs text-gray-500">
                        Current price: ${cryptoPrices[currency].toLocaleString()} per {currency}
                      </p>
                    )}
                  </div>
                  
                  {/* Show crypto conversion */}
                  {paymentMethod === "crypto" && cryptoAmount && (
                    <div className="mt-3 p-3 bg-orange-500/10 border border-orange-400/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-orange-300">You'll send:</span>
                        <div className="text-right">
                          <div className="text-orange-200 font-semibold">
                            {cryptoAmount} {currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show warning if amount is too low */}
                  {usdAmount && validateAmount() && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-400/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-red-400 text-sm">⚠️</span>
                        <span className="text-red-300 text-sm">{validateAmount()}</span>
                      </div>
                    </div>
                  )}
                  
                  {loadingPrices && paymentMethod === "crypto" && (
                    <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading current prices...</span>
                    </div>
                  )}
                </div>

                <div className="animate-slide-in-right" style={{ animationDelay: "0.4s" }}>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <span className="flex items-center space-x-2">
                      <span>🪙</span>
                      <span>Currency</span>
                    </span>
                  </label>
                  {paymentMethod === "paypal" ? (
                    <div className="w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white flex items-center font-medium">
                      USD
                    </div>
                  ) : (
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                      required
                    >
                      {currencies.map((curr) => (
                        <option key={curr.code} value={curr.code} className="bg-gray-800">
                          {curr.code} - {curr.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {error && (
                <div className="backdrop-blur-sm bg-red-500/10 border border-red-400/20 text-red-300 px-4 py-3 rounded-2xl text-sm animate-shake">
                  <div className="flex items-center space-x-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div
                className="backdrop-blur-sm bg-orange-500/10 border border-orange-400/20 rounded-2xl p-6 animate-slide-in-up"
                style={{ animationDelay: "0.5s" }}
              >
                <h3 className="text-orange-300 font-semibold mb-3 flex items-center space-x-2">
                  <span>ℹ️</span>
                  <span>How Medius Escrow Works</span>
                </h3>
                <ul className="text-sm text-orange-200/80 space-y-2">
                  <li className="flex items-start space-x-2 animate-fade-in" style={{ animationDelay: "0.6s" }}>
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>Enter the USD amount you want to escrow</span>
                  </li>
                  <li className="flex items-start space-x-2 animate-fade-in" style={{ animationDelay: "0.7s" }}>
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>We convert to crypto at current market rates (live prices)</span>
                  </li>
                  <li className="flex items-start space-x-2 animate-fade-in" style={{ animationDelay: "0.8s" }}>
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>You deposit the calculated crypto amount</span>
                  </li>
                  <li className="flex items-start space-x-2 animate-fade-in" style={{ animationDelay: "0.9s" }}>
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>Both parties confirm when the deal is complete</span>
                  </li>
                  <li className="flex items-start space-x-2 animate-fade-in" style={{ animationDelay: "1.0s" }}>
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span className="text-orange-300 font-medium">Minimum amounts ensure sufficient funds to cover blockchain fees</span>
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={
                  loading || 
                  !!validateAmount() || 
                  (paymentMethod === "crypto" && loadingPrices) ||
                  !usdAmount ||
                  Number.parseFloat(usdAmount) <= 0
                }
                className="w-full bg-gradient-to-r from-orange-500/80 to-amber-500/80 hover:from-orange-500 hover:to-amber-500 backdrop-blur-sm border border-orange-400/30 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:shadow-xl hover:scale-[1.02] transform ease-out relative overflow-hidden group animate-slide-in-up"
                style={{ animationDelay: "0.6s" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      Creating Middleman Ticket...
                    </div>
                  ) : loadingPrices && paymentMethod === "crypto" ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      Loading Prices...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <span>Create Middleman Ticket</span>
                      <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                    </div>
                  )}
                </div>
              </button>
              </form>
           </div>
         </div>
       </div>
     </div>
   );
}