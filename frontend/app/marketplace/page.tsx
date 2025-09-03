"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { apiRequest, authApiRequest } from "@/lib/api"
import { CryptoSelectorCompact } from "@/components/crypto-selector"
import { PaymentSelectorCompact } from "@/components/payment-selector"
import SimplePriceFilter, { PriceRange } from "@/components/MarketplaceFilters"
import HotProducts from "@/components/HotProducts"
import TiltCard from "@/components/ui/tilt-card"
import ScrollFadeIn from "@/components/ui/scroll-fade-in"
import GlitchText from "@/components/ui/glitch-text"
import { Banknote, Coins, Plus, ShoppingCart } from "lucide-react"
import { StatefulButton } from "@/components/ui/stateful-button"

type Listing = {
  id: string
  seller_id: string
  title: string
  description?: string
  price_usd: number
  accept_all: boolean
  payment_methods: string[]
  status: string
  images?: string[]
  currencies?: string[]
  rating?: number
  seller_volume_usd?: number
  // Additional properties for HotProducts compatibility
  type?: string
  sellerId?: string
  createdAt?: string
  updatedAt?: string
  purchaseCount?: number
  ratingAverage?: number
  ratingCount?: number
  thumbnailUrl?: string
}

export default function MarketplacePage() {
  const [items, setItems] = useState<Listing[]>([])
  const [hotProducts, setHotProducts] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [currency, setCurrency] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [priceRange, setPriceRange] = useState<PriceRange>({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(24)
  const [message, setMessage] = useState("")
  const [anim, setAnim] = useState<{ id: string | null; phase: 'enter' | 'preExit' | 'exit' | null }>({ id: null, phase: null })

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL!, [])

  useEffect(() => {
    const init = async () => {
      try {
        await fetchListings(1)
        await fetchHotProducts()
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-apply filters with a small debounce
  useEffect(() => {
    const id = setTimeout(() => {
      fetchListings(1)
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, currency, paymentMethod, priceRange])

  const fetchListings = async (p = page) => {
    setError("")
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (currency) params.set('currency', currency)
    if (paymentMethod) params.set('payment_method', paymentMethod)
    if (priceRange.min) params.set('min_price', priceRange.min.toString())
    if (priceRange.max) params.set('max_price', priceRange.max.toString())
    params.set('page', String(p))
    params.set('limit', String(limit))
    const res = await apiRequest(`${apiBase}/api/marketplace?${params.toString()}`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to load marketplace')
      return
    }
    const data = await res.json()
    setItems(data.items || [])
    setPage(p)
    // log search for recs
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && (q || currency || paymentMethod || priceRange.min || priceRange.max)) {
        await authApiRequest(`${apiBase}/api/marketplace/search/log`, session, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, filters: { currency, payment_method: paymentMethod, price_min: priceRange.min, price_max: priceRange.max } })
        })
      }
    } catch {}
  }

  const fetchHotProducts = async () => {
    try {
      const res = await apiRequest(`${apiBase}/api/marketplace/hot-products`)
      if (res.ok) {
        const data = await res.json()
        setHotProducts(data.products || [])
      }
    } catch {}
  }

  const maybeFetchRecommendations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await authApiRequest(`${apiBase}/api/marketplace/recommendations`, session)
      if (!res.ok) return
      const data = await res.json()
      if ((data.items || []).length > 0) {
        setItems(data.items)
        setMessage('Recommended for you')
      }
    } catch {}
  }

  const addToCart = async (listing: Listing, method: 'crypto' | 'paypal', selectedCurrency?: string) => {
    setError("")
    setMessage("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Please log in to add items to your cart.')
      throw new Error('Not logged in')
    }
    const body: any = { listing_id: listing.id, payment_method: method, quantity: 1 }
    if (method === 'crypto') body.selected_currency = selectedCurrency || 'BTC'
    const res = await authApiRequest(`${apiBase}/api/cart`, session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      const msg = j.error || 'Failed to add to cart'
      setError(msg)
      throw new Error(msg)
    }
    // Optionally refresh a lightweight cart badge in the future
    setAnim({ id: listing.id, phase: 'enter' })
    setTimeout(() => {
      // prepare upward exit: place original label below without transition, then animate up
      setAnim({ id: listing.id, phase: 'preExit' })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnim({ id: listing.id, phase: 'exit' })
          setTimeout(() => setAnim({ id: null, phase: null }), 350)
        })
      })
    }, 900)
  }

  const addDefaultToCart = async (listing: Listing) => {
    const supported = (listing.payment_methods || []) as Array<'crypto' | 'paypal'>
    const method: 'crypto' | 'paypal' = supported.includes('paypal') ? 'paypal' : 'crypto'
    const currencyPick = method === 'crypto' ? ((listing.currencies && listing.currencies[0]) || 'BTC') : undefined
    await addToCart(listing, method, currencyPick)
  }

  const startMessaging = async (listing: Listing) => {
    setError("")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Please log in to message the seller.')
      return
    }
    const res = await authApiRequest(`${apiBase}/api/messages/start-from-listing`, session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listing.id })
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to start conversation')
      return
    }
    const data = await res.json()
    const convId = data.conversation_id
    window.location.href = `/messages?c=${encodeURIComponent(convId)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading marketplace...</div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Top-left glow (match dashboard) */}
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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header + primary action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold">
              <GlitchText text="Marketplace" />
              <span className="text-orange-400">.</span>
            </h1>
            <p className="text-gray-400">Browse listings and add to your cart.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link href="/marketplace/create" className="h-10 px-4 rounded-xl bg-black text-white border border-white/10 hover:border-white/20 flex items-center justify-center gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> New listing
            </Link>
            <Link href="/cart" className="h-10 px-4 rounded-xl bg-black text-white border border-white/10 hover:border-white/20 flex items-center justify-center gap-2 w-full sm:w-auto">
              <ShoppingCart className="h-4 w-4" /> Cart
            </Link>
          </div>
        </div>

        {/* Sticky filters + action (desktop pinned) */}
        <div className="sticky top-[64px] z-30 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2 py-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search listings"
              className="h-10 px-3 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-500"
            />
            <div className="min-w-[200px]">
              <PaymentSelectorCompact
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v)}
                placeholder="All methods"
              />
            </div>
            {paymentMethod !== 'paypal' && (
              <div className="min-w-[220px]">
                <CryptoSelectorCompact
                  value={currency}
                  onValueChange={(v) => setCurrency(v)}
                  placeholder="All currencies"
                />
              </div>
            )}
            <SimplePriceFilter
              value={priceRange}
              onChange={setPriceRange}
            />
            {/* Removed duplicate New listing button to avoid two CTAs */}
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 text-blue-200">{message}</div>}

        {/* Hot Products Section - Hidden for now */}
        {false && (
          <div className="mb-8">
            <HotProducts
              products={hotProducts as any}
              onProductClick={(product) => window.location.href = `/marketplace/${product.id}`}
            />
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-gray-400">No listings yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((l, i) => (
              <ScrollFadeIn key={l.id} delay={i*60}>
              <div className="rounded-2xl bg-[#12161C] border border-[#222831] overflow-hidden">
                <div className="relative">
                  {l.images && l.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={l.title} src={l.images[0]} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-orange-500/10 to-black" />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="p-4 space-y-3 text-[#E5E7EB]">
                  {/* Title + Price */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate" title={l.title}>{l.title}</div>
                    <div className="text-[#EA580C] font-bold">${l.price_usd.toFixed(2)}</div>
                  </div>

                  {/* Payment method chips */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {(l.payment_methods || []).includes('paypal') && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300">
                        <Banknote className="h-3.5 w-3.5" /> PayPal
                      </span>
                    )}
                    {(l.payment_methods || []).includes('crypto') && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300">
                        <Coins className="h-3.5 w-3.5" /> Crypto
                      </span>
                    )}
                  </div>

                  {/* Meta row removed */}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <StatefulButton
                      onClick={() => addDefaultToCart(l)}
                      className={`flex-1 h-9 px-3 rounded-lg bg-[#EA580C] text-white font-semibold hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#93C5FD]`}
                      success={
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          Added
                        </>
                      }
                    >
                      Add to cart
                    </StatefulButton>
                    <Link href={`/marketplace/${l.id}`} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm flex items-center focus:outline-none focus:ring-2 focus:ring-[#93C5FD]">View</Link>
                    <button onClick={() => startMessaging(l)} className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#93C5FD]">Message</button>
                  </div>
                </div>
              </div>
              </ScrollFadeIn>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}