"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Match the exact look and interactions of crypto-selector, but for payment methods
const PAYMENT_METHODS: { value: string; label: string; symbol?: string }[] = [
  { value: "", label: "All methods", symbol: "All" },
  { value: "crypto", label: "Crypto", symbol: "Crypto" },
  { value: "paypal", label: "PayPal", symbol: "PayPal" },
]

interface PaymentSelectorProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options?: { value: string; label: string; symbol?: string }[]
}

export function PaymentSelector({
  value,
  onValueChange,
  placeholder = "All methods",
  options: optionsProp,
}: PaymentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const options = optionsProp || PAYMENT_METHODS
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((m) => m.label.toLowerCase().includes(q) || (m.symbol || "").toLowerCase().includes(q))
  }, [query, options])

  const selected = options.find((m) => m.value === (value ?? ""))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 px-3 text-sm rounded-xl bg-black border border-white/10 text-white transition-all duration-200 hover:bg-black hover:border-white/20"
        >
          {selected ? (
            <div className="flex items-center gap-2 animate-in fade-in-0 slide-in-from-left-1 duration-200">
              <span className="font-medium">{selected.label}</span>
              {selected.symbol ? <span className="text-gray-400">({selected.symbol})</span> : null}
            </div>
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
              placeholder="Search methods..."
              className="bg-transparent text-white placeholder:text-gray-500 flex-1 focus:outline-none text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto bg-black [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-white/30">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-gray-400 text-sm">No methods found.</div>
            ) : (
              filtered.map((m, index) => (
                <button
                  key={m.value + index}
                  onClick={() => {
                    onValueChange?.(m.value)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/5 transition-colors duration-150 flex items-center gap-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{m.label}</span>
                    {m.symbol ? <span className="text-gray-400">({m.symbol})</span> : null}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 transition-all duration-200",
                      (value ?? "") === m.value ? "opacity-100 text-green-400 scale-100" : "opacity-0 scale-75",
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

export function PaymentSelectorCompact(props: PaymentSelectorProps) {
  return <PaymentSelector {...props} />
}
