"use client"

import type React from "react"

import { useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { authApiRequest } from "@/lib/api"
import { CryptoSelectorCompact } from "@/components/crypto-selector"
import { CurrencySelectorRow, type CurrencyRate } from "@/components/selector"
import type { PricingRules } from "@/lib/types"
import { CustomRadioGroup } from "@/components/ui/custom-radio-group"
import { Wallet, CreditCard, Upload, Plus, X, DollarSign, Check } from "lucide-react"

const ALL_CURRENCIES = [
  "BTC",
  "ETH",
  "LTC",
  "BCH",
  "DOGE",
  "XRP",
  "ADA",
  "DOT",
  "MATIC",
  "SOL",
  "AVAX",
  "TRX",
  "BNB",
  "ATOM",
  "XLM",
  "USDT-ERC20",
  "USDT-BEP20",
  "USDT-SOL",
  "USDT-TRON",
]

const paymentMethodOptions = [
  { value: "crypto", label: "Cryptocurrency", icon: <Wallet size={16} /> },
  { value: "paypal", label: "PayPal", icon: <CreditCard size={16} /> },
]

// Rate mode: 'percent' for percentage fees, 'fixed' for fixed USD amounts
const RATE_MODE: 'percent' | 'fixed' = 'fixed'

export default function CreateListingPage() {
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL!, [])
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState<string>("")
  const [priceError, setPriceError] = useState<string>("")
  const [acceptAll, setAcceptAll] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["crypto", "paypal"])
  const [images, setImages] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["BTC"])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // Per-currency fee overrides
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([])

  // Dynamic Delivery
  const [deliveryUrl, setDeliveryUrl] = useState("")
  const [deliveryUrlError, setDeliveryUrlError] = useState<string>("")

  const toggleMethod = (m: string) => {
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  const toggleCurrency = (c: string) => {
    setCurrencies((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const addImage = () => {
    const url = prompt("Paste image URL")?.trim()
    if (url) setImages((prev) => [...prev, url])
  }

  const validateUrl = (u: string) => {
    if (!u) return ""
    return /^https?:\/\//i.test(u) ? "" : "Must start with http:// or https://"
  }

  // File upload refs/state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File) => {
    try {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image too large (max 5MB)")
        return
      }
      setUploading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setError("Please log in")
        return
      }
      const fd = new FormData()
      fd.append("image", file)
      const res = await authApiRequest(`${apiBase}/api/upload/image`, session, {
        method: "POST",
        body: fd,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || "Upload failed")
        return
      }
      if (j.url) setImages((prev) => [...prev, j.url])
    } catch (e: any) {
      setError(e?.message || "Upload error")
    } finally {
      setUploading(false)
    }
  }

  const onFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((f) => uploadFile(f))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    onFiles(e.dataTransfer.files)
  }

  const validateAndSetPrice = (value: string) => {
    // Allow only digits and decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length > 2) return
    // Limit decimals to 2
    if (parts[1] && parts[1].length > 2) return
    setPrice(cleaned)
    const n = Number.parseFloat(cleaned)
    if (isNaN(n) || n <= 0) setPriceError("Price must be a positive number")
    else if (n > 1000000) setPriceError("Price cannot exceed $1,000,000")
    else setPriceError("")
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const submit = async () => {
    // Debug helpers: set busy and clear UI messages up front
    setError("")
    setMessage("")
    setBusy(true)
    try {
      console.debug("submit() called", { title, price, acceptAll, paymentMethods, images, currencies })
      const {
        data: { session },
      } = await supabase.auth.getSession()
      console.debug("session result from supabase.auth.getSession()", { session })
      if (!session) {
        setError("Please log in")
        console.warn("submit aborted: no session")
        return
      }

      // Validate delivery URL
      const urlErr = validateUrl(deliveryUrl)
      setDeliveryUrlError(urlErr)
      if (urlErr) {
        setError(urlErr)
        return
      }

      const priceVal = Number.parseFloat(price)

      // Build currencies map from currencyRates
      const currenciesMap: Record<string, { percent?: number; fixed_usd?: number }> = {}
      for (const r of currencyRates) {
        if (!r.currency) continue
        const num = Number(r.amount)
        if (!Number.isFinite(num)) continue
        if (RATE_MODE === 'percent') currenciesMap[r.currency] = { percent: num }
        else currenciesMap[r.currency] = { fixed_usd: num }
      }

      // Build pricing_rules with defaults + currency overrides only
      // Method fees are now handled server-side with fixed defaults
      const pricing_rules = {
        currencies: currenciesMap, // Only currency-specific overrides
      }

      const body: any = {
        title: title.trim(),
        description: description.trim(),
        price_usd: priceVal,
        accept_all: acceptAll,
        payment_methods: paymentMethods,
        images: images.map((u, i) => ({ url: u, sort_order: i })),
        fulfillment_url: deliveryUrl.trim() || null,
        pricing_rules,
      }
      if (!acceptAll) body.allowed_currencies = currencies

      console.debug("about to call API", { api: `${apiBase}/api/marketplace`, body })
      let res
      try {
        res = await authApiRequest(`${apiBase}/api/marketplace`, session, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
      } catch (fetchErr) {
        console.error("fetch error when calling /api/marketplace", fetchErr)
        setError("Network error when creating listing")
        return
      }

      const j = await res.json().catch(() => ({}))
      console.debug("create response", { status: res.status, body: j })
      if (!res.ok) {
        setError(j.error || "Failed to create listing")
        return
      }

      // Redirect to the created listing page if we have an id
      const created = j
      if (created && (created.id || created["id"])) {
        const id = created.id || created["id"]
        console.info("listing created, redirecting to", `/marketplace/${id}`)
        console.info("listing data:", created)
        router.push(`/marketplace/${id}`)
        return
      }

      // Fallback: show success and clear form
      setMessage("Listing created!")
      setTitle("")
      setDescription("")
      setPrice("")
      setImages([])
    } catch (err: any) {
      console.error("submit() unexpected error", err)
      setError(err?.message || String(err) || "Unexpected error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <motion.div
        className="absolute top-0 left-0 -z-10 rounded-2xl overflow-hidden pointer-events-none mix-blend-screen"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{
          width: "min(50vw, 50vh)",
          height: "min(50vw, 50vh)",
          background:
            "radial-gradient(28% 28% at 18% 14%, rgba(255,180,110,0.78) 0%, rgba(255,180,110,0.00) 60%), " +
            "radial-gradient(70% 70% at 25% 20%, rgba(251,146,60,0.62) 0%, rgba(251,146,60,0.00) 62%), " +
            "linear-gradient(135deg, rgba(251,146,60,0.34) 0%, rgba(251,146,60,0.00) 70%)",
        }}
      />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-3xl font-bold mb-2">
            Create Listing<span className="text-orange-400">.</span>
          </h1>
          <p className="text-gray-400 mb-6">Fill out details below and submit for moderation.</p>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200"
            >
              {error}
            </motion.div>
          )}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-4 rounded-xl border border-green-400/30 bg-green-500/10 p-4 text-green-200"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
        >
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <label className="block text-sm text-gray-300 mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 transition-all duration-200 focus:border-orange-400/50 focus:bg-white/15 focus:outline-none"
              placeholder="Enter listing title..."
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <label className="block text-sm text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 transition-all duration-200 focus:border-orange-400/50 focus:bg-white/15 focus:outline-none resize-none"
              placeholder="Describe your item..."
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <label className="block text-sm text-gray-300 mb-2">Price (USD)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                value={price}
                onChange={(e) => validateAndSetPrice(e.target.value)}
                type="text"
                placeholder="0.00"
                className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border transition-all duration-200 focus:outline-none ${
                  priceError
                    ? "border-red-400 focus:border-red-400"
                    : "border-white/15 focus:border-orange-400/50 focus:bg-white/15"
                }`}
              />
            </div>
            <AnimatePresence>
              {priceError && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-red-400 text-xs mt-2"
                >
                  {priceError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <div className="text-sm text-gray-300 font-medium">Payment Methods</div>
              <CustomRadioGroup
                options={paymentMethodOptions}
                value={paymentMethods}
                onChange={toggleMethod}
                multiple={true}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3"
            >
              <div className="text-sm text-gray-300 font-medium">Currencies (crypto)</div>
              <motion.label
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative">
                  <motion.div
                    className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                      acceptAll ? "border-orange-400 bg-orange-400" : "border-white/30"
                    }`}
                  >
                    <AnimatePresence>
                      {acceptAll && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="flex items-center justify-center h-full"
                        >
                          <Check size={12} className="text-black" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
                <span className="text-sm text-gray-300">Accept all currencies</span>
                <input
                  type="checkbox"
                  checked={acceptAll}
                  onChange={() => setAcceptAll((v) => !v)}
                  className="sr-only"
                />
              </motion.label>

              <AnimatePresence>
                {!acceptAll && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="text-xs text-gray-400">Select specific currencies:</div>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {ALL_CURRENCIES.map((c, index) => (
                        <motion.label
                          key={c}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={currencies.includes(c)}
                            onChange={() => toggleCurrency(c)}
                            className="w-3 h-3 rounded border border-white/30 bg-white/10 checked:bg-orange-400 checked:border-orange-400"
                          />
                          <span className="text-xs text-gray-300">{c}</span>
                        </motion.label>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">Quick select:</div>
                    <CryptoSelectorCompact
                      value=""
                      onValueChange={(v) => {
                        if (v && !currencies.includes(v)) setCurrencies((prev) => [...prev, v])
                      }}
                      placeholder="Add a currency"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-300 font-medium">Images</div>
              <div className="flex items-center gap-2">
                <motion.label
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-sm cursor-pointer transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Upload size={14} />
                  Upload
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFiles(e.target.files)}
                    className="hidden"
                  />
                </motion.label>
              </div>
            </div>

            <motion.div
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setDragActive(false)
              }}
              onDrop={handleDrop}
              className={`p-4 rounded-xl border-2 border-dashed transition-all duration-200 ${
                dragActive ? "border-orange-400/50 bg-orange-400/5" : "border-white/20 bg-white/5"
              }`}
              animate={{
                borderColor: dragActive ? "rgba(251, 146, 60, 0.5)" : "rgba(255, 255, 255, 0.2)",
                backgroundColor: dragActive ? "rgba(251, 146, 60, 0.05)" : "rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="text-center">
                <div className="text-sm text-gray-400">Drag & drop images here or use Upload button</div>
                <div className="text-xs text-gray-500 mt-1">Max 5MB each • JPG, PNG, GIF</div>
              </div>
              <AnimatePresence>
                {uploading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-orange-400 mt-2 text-center"
                  >
                    Uploading...
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence>
              {images.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-gray-400 mt-3 text-center"
                >
                  No images added yet
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
                >
                  {images.map((u, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative group border border-white/10 rounded-xl overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u || "/placeholder.svg"}
                        alt="preview"
                        className="w-full h-32 object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <motion.button
                        onClick={() => removeImage(i)}
                        className="absolute top-2 right-2 p-1 bg-black/70 border border-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-500/70"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X size={12} className="text-white" />
                      </motion.button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Dynamic Delivery URL */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-300 font-medium">Dynamic Delivery URL</div>
              <span className="text-[11px] text-gray-500">Seller-only • called when escrow is funded</span>
            </div>
            <input
              value={deliveryUrl}
              onChange={(e) => {
                setDeliveryUrl(e.target.value)
                setDeliveryUrlError(validateUrl(e.target.value))
              }}
              placeholder="http://your-server.com/callback"
              className={`w-full px-4 py-2.5 rounded-xl bg-white/10 border transition-all duration-200 focus:outline-none text-sm ${
                deliveryUrlError ? 'border-red-400 focus:border-red-400' : 'border-white/15 focus:border-orange-400/50 focus:bg-white/15'
              }`}
            />
            {deliveryUrlError && <p className="text-xs text-red-400">{deliveryUrlError}</p>}
            <p className="text-[11px] text-gray-500">
              We POST once the escrow is funded. Headers: X-Medius-Event, X-Medius-Idempotency-Key, X-Medius-Timestamp.
            </p>
          </motion.div>



          {/* Per-currency fee overrides */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="col-span-12 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-300 font-medium">Per-currency fees</div>
              <button
                type="button"
                onClick={() => setCurrencyRates(prev => [...prev, { currency: "", amount: "" }])}
                className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors duration-200"
              >
                + Add
              </button>
            </div>

            {currencyRates.length === 0 ? (
              <div className="text-xs text-gray-500 px-3 py-2">
                No currency-specific fees added. Click "Add" to define a fee for a crypto currency.
              </div>
            ) : (
              <div className="space-y-2">
                {currencyRates.map((row, i) => (
                  <CurrencySelectorRow
                    key={i}
                    value={row}
                    used={currencyRates.map(r => r.currency).filter(Boolean)}
                    suffix={RATE_MODE === 'percent' ? '%' : '$'}
                    onChange={(val: CurrencyRate) => {
                      setCurrencyRates(prev => {
                        const next = [...prev]
                        next[i] = val
                        return next
                      })
                    }}
                    onRemove={() => setCurrencyRates(prev => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-500">
              These apply on top of method fees. Defaults: PayPal 2% flat; Crypto 2% under $50, 1.5% for $50+.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="pt-4"
          >
            <motion.button
              disabled={busy}
              onClick={submit}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: busy ? 1 : 0.98 }}
            >
              {busy ? "Creating Listing..." : "Create Listing"}
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
