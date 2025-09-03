"use client"

import { useMemo, useState, ReactNode } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Generic type for any selectable item
export interface SelectableItem {
  value: string
  label: string
  [key: string]: any // Allow additional properties
}

// Currency rate interface for fee overrides
export interface CurrencyRate {
  currency: string
  amount: number | ''
}

// Universal selector props
export interface UniversalSelectorProps<T extends SelectableItem> {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options?: T[]
  displayFields?: (keyof T)[] // Which fields to show in the display
  searchFields?: (keyof T)[] // Which fields to search through
  renderOption?: (item: T, isSelected: boolean) => ReactNode // Custom render function
  renderSelected?: (item: T) => ReactNode // Custom render for selected item
  emptyMessage?: string
  searchPlaceholder?: string
  allowEmpty?: boolean
  className?: string
  disabled?: boolean
}

// Currency selector row props
export interface CurrencySelectorRowProps {
  value: CurrencyRate
  onChange: (value: CurrencyRate) => void
  onRemove: () => void
  used: string[] // Already used currencies to prevent duplicates
  suffix?: string // '%' or '$'
}

// Universal selector component
export function UniversalSelector<T extends SelectableItem>({
  value,
  onValueChange,
  placeholder = "Select an option...",
  options = [],
  displayFields = ["label"] as (keyof T)[],
  searchFields = ["label", "value"] as (keyof T)[],
  renderOption,
  renderSelected,
  emptyMessage = "No options found.",
  searchPlaceholder = "Search...",
  allowEmpty = true,
  className,
  disabled = false,
}: UniversalSelectorProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options

    return options.filter((item) =>
      searchFields.some((field) => {
        const fieldValue = item[field]
        return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(q)
      })
    )
  }, [query, options, searchFields])

  const selectedItem = options.find((item) => item.value === value)

  // Default render functions
  const defaultRenderSelected = (item: T) => (
    <div className="flex items-center gap-2 animate-in fade-in-0 slide-in-from-left-1 duration-200">
      <span className="font-medium">{item.label}</span>
      {displayFields.slice(1).map((field) => {
        const fieldValue = item[field]
        return typeof fieldValue === 'string' ? (
          <span key={String(field)} className="text-gray-400">({fieldValue})</span>
        ) : null
      })}
    </div>
  )

  const defaultRenderOption = (item: T, isSelected: boolean) => (
    <div className="flex items-center gap-2 flex-1">
      <span className="font-medium">{item.label}</span>
      {displayFields.slice(1).map((field) => {
        const fieldValue = item[field]
        return typeof fieldValue === 'string' ? (
          <span key={String(field)} className="text-gray-400">({fieldValue})</span>
        ) : null
      })}
    </div>
  )

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 px-3 text-sm rounded-xl bg-black border border-white/10 text-white transition-all duration-200 hover:bg-black hover:border-white/20",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          {selectedItem ? (
            renderSelected ? renderSelected(selectedItem) : defaultRenderSelected(selectedItem)
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ease-in-out",
              open && "rotate-180 text-white",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-black border border-white/10 rounded-xl shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 ease-out">
        <div className="bg-black rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-black">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent text-white placeholder:text-gray-500 flex-1 focus:outline-none text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto bg-black [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-white/30">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-sm">{emptyMessage}</div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={item.value}
                  onClick={() => {
                    const currentValue: string = item.value
                    onValueChange?.(allowEmpty && currentValue === (value || "") ? "" : currentValue)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/5 transition-colors duration-150 flex items-center gap-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {renderOption ? renderOption(item, value === item.value) : defaultRenderOption(item, value === item.value)}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 transition-all duration-200",
                      value === item.value ? "opacity-100 text-green-400 scale-100" : "opacity-0 scale-75",
                    )}
                  />
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Pre-configured components for common use cases
export function CountrySelector({
  value,
  onValueChange,
  ...props
}: Omit<UniversalSelectorProps<any>, 'options' | 'displayFields' | 'searchFields'>) {
  const countries = [
    { value: "us", label: "United States", code: "US", flag: "🇺🇸" },
    { value: "ca", label: "Canada", code: "CA", flag: "🇨🇦" },
    { value: "gb", label: "United Kingdom", code: "GB", flag: "🇬🇧" },
    { value: "de", label: "Germany", code: "DE", flag: "🇩🇪" },
    { value: "fr", label: "France", code: "FR", flag: "🇫🇷" },
    { value: "jp", label: "Japan", code: "JP", flag: "🇯🇵" },
    { value: "au", label: "Australia", code: "AU", flag: "🇦🇺" },
  ]

  return (
    <UniversalSelector
      value={value}
      onValueChange={onValueChange}
      options={countries}
      displayFields={["flag", "label"]}
      searchFields={["label", "code"]}
      searchPlaceholder="Search countries..."
      emptyMessage="No countries found."
      placeholder="Select country..."
      {...props}
    />
  )
}

export function CurrencySelector({
  value,
  onValueChange,
  ...props
}: Omit<UniversalSelectorProps<any>, 'options' | 'displayFields' | 'searchFields'>) {
  const currencies = [
    { value: "USD", label: "US Dollar", symbol: "$", code: "USD" },
    { value: "EUR", label: "Euro", symbol: "€", code: "EUR" },
    { value: "GBP", label: "British Pound", symbol: "£", code: "GBP" },
    { value: "JPY", label: "Japanese Yen", symbol: "¥", code: "JPY" },
    { value: "CAD", label: "Canadian Dollar", symbol: "C$", code: "CAD" },
    { value: "AUD", label: "Australian Dollar", symbol: "A$", code: "AUD" },
  ]

  return (
    <UniversalSelector
      value={value}
      onValueChange={onValueChange}
      options={currencies}
      displayFields={["label", "symbol"]}
      searchFields={["label", "code", "symbol"]}
      searchPlaceholder="Search currencies..."
      emptyMessage="No currencies found."
      placeholder="Select currency..."
      {...props}
    />
  )
}

export function PaymentMethodSelector({
  value,
  onValueChange,
  ...props
}: Omit<UniversalSelectorProps<any>, 'options' | 'displayFields' | 'searchFields'>) {
  const paymentMethods = [
    { value: "paypal", label: "PayPal", icon: "💳", fee: "2%" },
    { value: "crypto", label: "Cryptocurrency", icon: "₿", fee: "Tiered" },
    { value: "card", label: "Credit Card", icon: "💳", fee: "2.9%" },
    { value: "bank", label: "Bank Transfer", icon: "🏦", fee: "Free" },
  ]

  return (
    <UniversalSelector
      value={value}
      onValueChange={onValueChange}
      options={paymentMethods}
      displayFields={["icon", "label", "fee"]}
      searchFields={["label", "value"]}
      searchPlaceholder="Search payment methods..."
      emptyMessage="No payment methods found."
      placeholder="Select payment method..."
      renderOption={(item, isSelected) => (
        <div className="flex items-center gap-3 flex-1">
          <span className="text-lg">{item.icon}</span>
          <div>
            <span className="font-medium">{item.label}</span>
            <span className="text-xs text-gray-400 ml-2">({item.fee})</span>
          </div>
        </div>
      )}
      renderSelected={(item) => (
        <div className="flex items-center gap-2 animate-in fade-in-0 slide-in-from-left-1 duration-200">
          <span className="text-lg">{item.icon}</span>
          <span className="font-medium">{item.label}</span>
          <span className="text-gray-400">({item.fee})</span>
        </div>
      )}
      {...props}
    />
  )
}

// Cryptocurrency options for selectors
const CRYPTO_CURRENCIES: SelectableItem[] = [
  { value: "BTC", label: "Bitcoin", symbol: "BTC" },
  { value: "ETH", label: "Ethereum", symbol: "ETH" },
  { value: "LTC", label: "Litecoin", symbol: "LTC" },
  { value: "BCH", label: "Bitcoin Cash", symbol: "BCH" },
  { value: "DOGE", label: "Dogecoin", symbol: "DOGE" },
  { value: "XRP", label: "XRP", symbol: "XRP" },
  { value: "ADA", label: "Cardano", symbol: "ADA" },
  { value: "DOT", label: "Polkadot", symbol: "DOT" },
  { value: "MATIC", label: "Polygon", symbol: "MATIC" },
  { value: "SOL", label: "Solana", symbol: "SOL" },
  { value: "AVAX", label: "Avalanche", symbol: "AVAX" },
  { value: "TRX", label: "TRON", symbol: "TRX" },
  { value: "BNB", label: "BNB", symbol: "BNB" },
  { value: "ATOM", label: "Cosmos", symbol: "ATOM" },
  { value: "XLM", label: "Stellar", symbol: "XLM" },
  { value: "USDT-ERC20", label: "Tether (ERC20)", symbol: "USDT" },
  { value: "USDT-BEP20", label: "Tether (BEP20)", symbol: "USDT" },
  { value: "USDT-SOL", label: "Tether (Solana)", symbol: "USDT" },
  { value: "USDT-TRON", label: "Tether (TRC20)", symbol: "USDT" },
]

// Currency selector row component for fee overrides
export function CurrencySelectorRow({
  value,
  onChange,
  onRemove,
  used,
  suffix = "%"
}: CurrencySelectorRowProps) {
  // Filter out already used currencies
  const availableCurrencies = CRYPTO_CURRENCIES.filter(crypto => !used.includes(crypto.value) || crypto.value === value.currency)

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
      {/* Currency Selector */}
      <div className="flex-1 min-w-0">
        <UniversalSelector
          value={value.currency}
          onValueChange={(newCurrency) => onChange({ ...value, currency: newCurrency })}
          options={availableCurrencies}
          placeholder="Select currency..."
          displayFields={["label", "symbol"]}
          searchFields={["label", "symbol", "value"]}
          searchPlaceholder="Search currencies..."
          emptyMessage="No currencies available."
          className="w-full"
          renderSelected={(item) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{item.label}</span>
              <span className="text-gray-400 text-xs">({item.symbol})</span>
            </div>
          )}
        />
      </div>

      {/* Amount Input */}
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="number"
          step="0.01"
          min="0"
          value={value.amount}
          onChange={(e) => {
            const numValue = e.target.value === "" ? "" : Number(e.target.value)
            onChange({ ...value, amount: numValue })
          }}
          placeholder="0.00"
          className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-orange-400/50 focus:bg-white/15"
        />
        <span className="text-gray-400 text-sm font-medium">{suffix}</span>
      </div>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors duration-200"
        title="Remove this fee override"
      >
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Export the universal component as the default export
export default UniversalSelector
