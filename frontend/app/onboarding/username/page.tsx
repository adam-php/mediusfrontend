"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function UsernameOnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)

  const inputBase =
    "h-12 w-full rounded-md border border-white/10 bg-[#111111] px-3 text-[16px] text-white " +
    "placeholder:text-[16px] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40"

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/auth")
        return
      }
      setSession(session)

      // Already has a username? Skip.
      const { data: existing } = await supabase
  .from("profiles")
  .select("id, username")
  .eq("id", session.user.id)
  .maybeSingle()
      if (existing?.username) {
        router.replace("/dashboard")
        return
      }

      // Prefill from pending storage if present
      try {
        const pending = localStorage.getItem("medius_pending_username") || ""
        if (pending) setUsername(pending)
      } catch {}

      // Surface “taken” message if redirected with ?e=taken
      const e = searchParams.get("e")
      if (e === "taken") setError("That username is already taken. Please choose another.")
    }
    init()
  }, [router, searchParams])

  const validate = (u: string) => {
    const cleaned = u.trim().toLowerCase()
    if (cleaned.length < 3 || cleaned.length > 20) return "Username must be 3–20 characters."
    if (!/^[a-z0-9._-]+$/.test(cleaned)) return "Only letters, numbers, dot, underscore, and dash are allowed."
    return null
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleaned = username.trim().toLowerCase()
    const v = validate(cleaned)
    if (v) { setError(v); return }
    if (!session) return

    setLoading(true)
    try {
      const email = session.user.email || null
      const { error: insertErr } = await supabase
        .from("profiles")
        .upsert({ id: session.user.id, username: cleaned, email }, { onConflict: 'id' })

      if (insertErr) {
        if (insertErr.code === "23505" || insertErr.message?.toLowerCase().includes("duplicate")) {
          setError("That username is already taken. Please choose another.")
        } else {
          setError(insertErr.message || "Could not set username.")
        }
        return
      }

      try { localStorage.removeItem("medius_pending_username") } catch {}
      try { localStorage.removeItem("medius_pending_email") } catch {}
      router.replace("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white">
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0c]/95 p-8">
        <h1 className="text-center text-2xl font-semibold">Pick your username</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="flex group">
            <span className="relative inline-flex h-12 items-center rounded-l-md border border-r-0 border-white/10 bg-[#111111] px-3 text-[16px] text-white/60 after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-white/10 group-focus-within:after:bg-orange-500/50">
              medius.com/
            </span>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`${inputBase} rounded-l-none border-l-0`}
              placeholder="username"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-orange-500 text-[15px] font-semibold text-white hover:bg-orange-500/90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  )
}
