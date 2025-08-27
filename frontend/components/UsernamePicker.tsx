"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

type UserLite = { id: string; username: string; display_name?: string; avatar_url?: string }

export default function UsernamePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value)
  const [results, setResults] = useState<UserLite[]>([])
  const [open, setOpen] = useState(false)
  const [exactMatch, setExactMatch] = useState<UserLite | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastRequestTime = useRef<number>(0)

  useEffect(() => { setQ(value) }, [value])

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (!q || q.length < 2) {
      setResults([])
      setExactMatch(null)
      setOpen(false)
      setIsLoading(false)
      setRateLimited(false)
      return
    }

    setIsLoading(true)

    timeoutRef.current = setTimeout(async () => {
      // Check if we're making requests too frequently
      const now = Date.now()
      const timeSinceLastRequest = now - lastRequestTime.current

      if (timeSinceLastRequest < 1000) { // Minimum 1 second between requests
        setRateLimited(true)
        setTimeout(() => {
          setIsLoading(false)
          setRateLimited(false)
        }, 1000)
        return
      }

      try {
        abortControllerRef.current = new AbortController()
        lastRequestTime.current = now

        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) {
          setIsLoading(false)
          setRateLimited(false)
          return
        }

        const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/users/search`)
        url.searchParams.set("q", q)

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current.signal
        })

        if (res.status === 429) {
          // Rate limited - wait longer before allowing new requests
          setRateLimited(true)
          setTimeout(() => {
            setIsLoading(false)
            setRateLimited(false)
          }, 5000) // Wait 5 seconds after rate limit
          return
        }

        setRateLimited(false)

        if (res.ok) {
          const users = await res.json()
          setResults(users)

          // Check for exact username match
          const exact = users.find((user: UserLite) => user.username.toLowerCase() === q.toLowerCase())
          setExactMatch(exact)

          // If exact match found, auto-select it
          if (exact) {
            onChange(exact.username)
            setQ(exact.username)
            setOpen(false)
          } else if (users.length > 0) {
            // Show dropdown with partial matches
            setOpen(true)
          } else {
            // No matches found, close dropdown after showing loading briefly
            setTimeout(() => setOpen(false), 500)
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }, 500) // Increased debounce to 500ms

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [q])

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          // Don't allow typing when rate limited
          if (rateLimited) return

          setQ(e.target.value)
          // Show dropdown when user starts typing (will be hidden if no results)
          if (e.target.value.length >= 2) {
            setOpen(true)
          } else {
            setOpen(false)
          }
        }}
        onFocus={() => {
          // Show dropdown if we have results and query is long enough
          if (q.length >= 2 && results.length > 0) {
            setOpen(true)
          }
        }}
        placeholder="Type a username..."
        className={`w-full px-4 py-3 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 ${
          rateLimited ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />

      {/* Show dropdown with available users */}
      {open && q.length >= 2 && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/20 bg-black/80 backdrop-blur-xl max-h-64 overflow-auto">
          {results.length > 0 ? (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.username)
                  setQ(u.username)
                  setOpen(false)
                }}
                className="w-full px-4 py-3 text-left hover:bg-white/10 flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">👤</span>}
                </div>
                <div>
                  <div className="text-white text-sm">{u.username}</div>
                  {u.display_name && <div className="text-xs text-gray-400">{u.display_name}</div>}
                </div>
              </button>
            ))
          ) : isLoading ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 border border-orange-500 border-t-transparent rounded-full motion-safe:animate-spin"></div>
                <span>Searching...</span>
              </div>
            </div>
          ) : rateLimited ? (
            <div className="p-4 text-center text-yellow-400 text-sm">
              <div className="flex items-center justify-center space-x-2">
                <span>⏱️</span>
                <span>Too many requests. Please wait...</span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400 text-sm">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  )
}


