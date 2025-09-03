"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const callbackUrl = useMemo(() => `${window.location.origin}/auth/callback`, [])

  // Persist referral code on landing so it survives redirects
  useEffect(() => {
    const codeFromUrl = searchParams.get("ref")?.trim()
    if (codeFromUrl) {
      try { localStorage.setItem("medius_ref_code", codeFromUrl) } catch {}
    }
  }, [searchParams])

  // Helper: insert username row in your 'profiles' table if missing.
  // - only runs server-side via Supabase client here (RLS will ensure it's the user)
  // - enforces lowercase + trim
  async function ensureUsernameForSession(session: any, desiredUsername?: string, desiredEmail?: string) {
    if (!session) {
      console.log('ensureUsernameForSession: no session provided')
      return
    }
    const userId = session.user.id
    const finalEmail = desiredEmail || session.user.email || null
    const finalUsername = desiredUsername ? desiredUsername.trim().toLowerCase() : null

    console.log('ensureUsernameForSession called with:', {
      userId,
      desiredUsername,
      desiredEmail,
      sessionEmail: session.user.email,
      finalUsername,
      finalEmail
    })

    if (!finalUsername) {
      console.log('ensureUsernameForSession: no username to store')
      return
    }

    try {
      // Check if this user's profile already has a username
      console.log('ensureUsernameForSession: checking existing profile for user:', userId)
      const { data: existingForUser, error: err1 } = await supabase
        .from('profiles')
        .select('id, username, email')
        .eq('id', userId)
        .maybeSingle()

      if (err1) {
        console.warn('ensureUsernameForSession: check existing profile error', err1)
      } else {
        console.log('ensureUsernameForSession: existing profile data:', existingForUser)
      }

      if (existingForUser && existingForUser.username) {
        console.log('ensureUsernameForSession: user already has username, updating email if needed')
        // already set for user; update email if missing and we have one
        if (!existingForUser.email && finalEmail) {
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ email: finalEmail })
            .eq('id', userId)
          if (updateErr) {
            console.warn('ensureUsernameForSession: failed to update email', updateErr)
          } else {
            console.log('ensureUsernameForSession: successfully updated email')
          }
        }
        return
      }

      // Check if the desired username is taken by someone else
      console.log('ensureUsernameForSession: checking if username is taken:', finalUsername)
      const { data: taken, error: err2 } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', finalUsername)
        .maybeSingle()

      if (err2) {
        console.warn('ensureUsernameForSession: check username taken error', err2)
      } else {
        console.log('ensureUsernameForSession: username taken check result:', taken)
      }

      if (taken && taken.id !== userId) {
        console.log('ensureUsernameForSession: username is taken by another user')
        setError('That username is already taken. Please choose another.')
        return
      }

      // Upsert username into profiles table
      console.log('ensureUsernameForSession: upserting profile with:', {
        id: userId,
        username: finalUsername,
        email: finalEmail
      })
      const { error: insertErr } = await supabase.from('profiles').upsert({
        id: userId,
        username: finalUsername,
        email: finalEmail,
      }, { onConflict: 'id' })

      if (insertErr) {
        console.warn('ensureUsernameForSession: insert username error', insertErr)
        if (insertErr.message?.includes('duplicate') || insertErr.code === '23505') {
          setError('That username is already taken. Please choose another.')
        }
      } else {
        console.log('ensureUsernameForSession: successfully inserted/updated profile')
        // success — remove pending keys
        try { localStorage.removeItem('medius_pending_username') } catch {}
        try { localStorage.removeItem('medius_pending_email') } catch {}
      }
    } catch (e) {
      console.warn('ensureUsernameForSession failed with exception:', e)
    }
  }

  // If already authenticated, claim referral (if any), then sync pending username/email and redirect
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) return

      try {
        // If there's a pending username/email (from sign-up flow), try to insert it now
        try {
          const pendingUsername = typeof window !== 'undefined' ? (localStorage.getItem('medius_pending_username') || '') : ''
          const pendingEmail = typeof window !== 'undefined' ? (localStorage.getItem('medius_pending_email') || '') : ''
          if (pendingUsername) {
            await ensureUsernameForSession(session, pendingUsername, pendingEmail || undefined)
          }
        } catch (e) {
          console.warn('pending username sync failed', e)
        }

        const codeFromUrl = searchParams.get('ref')?.trim() || ""
        const codeFromStorage = typeof window !== "undefined" ? (localStorage.getItem("medius_ref_code") || "") : ""
        const code = (codeFromUrl || codeFromStorage || "").trim()
        if (code) {
          await fetch(`${API_URL}/api/referrals/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              'ngrok-skip-browser-warning': '1',
            },
            body: JSON.stringify({ code })
          }).catch(() => {})
        }
      } finally {
        try { if (typeof window !== "undefined") localStorage.removeItem("medius_ref_code") } catch {}
        // Route based on whether the user has a username
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const { data: row } = await supabase
              .from("usernames")
              .select("id")
              .eq("user_id", session.user.id)
              .maybeSingle()
            router.replace(row ? "/dashboard" : "/onboarding/username")
            return
          }
        } catch {}
      }
    }
    run()
  }, [router, searchParams, API_URL])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (password) {
        // Try password sign-in first
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (!signInErr) {
          // Claim referral & ensure username if provided
          try {
            const { data: { session } } = await supabase.auth.getSession()
            // if user provided a username, insert it for this session
            if (session && username.trim()) {
              await ensureUsernameForSession(session, username.trim(), email)
            }

            const codeFromUrl = searchParams.get("ref")?.trim() || ""
            const codeFromStorage = typeof window !== "undefined" ? (localStorage.getItem("medius_ref_code") || "") : ""
            const code = (codeFromUrl || codeFromStorage || "").trim()
            if (session && code) {
              await fetch(`${API_URL}/api/referrals/claim`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
                body: JSON.stringify({ code })
              }).catch(() => {})
            }
          } finally {
            try { if (typeof window !== "undefined") localStorage.removeItem("medius_ref_code") } catch {}
            // Decide destination based on whether the user has a username
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                const { data: row } = await supabase.from("usernames").select("id").eq("user_id", session.user.id).maybeSingle()
                router.replace(row ? "/dashboard" : "/onboarding/username")
                return
              }
            } catch {}
          }
          return
        }

        // If sign-in failed and a username was provided, attempt sign-up
        if (username.trim()) {
          // Save pending username/email so we can finish insertion after email confirmation
          const finalUsername = username.trim().toLowerCase()
          const finalEmail = email.trim()
          console.log('handleEmailSubmit: saving pending data for sign-up:', { finalUsername, finalEmail })
          try { localStorage.setItem('medius_pending_username', finalUsername) } catch {}
          try { localStorage.setItem('medius_pending_email', finalEmail) } catch {}

          const { data, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callbackUrl, data: { username: username.trim().toLowerCase() } },
          })
          if (signUpErr) throw signUpErr

          if (!data.session) {
            // No immediate session (email confirmation flow) — we've saved the pending username/email to localStorage above.
            setMessage("Check your email to confirm your account. After you confirm and the redirect happens we'll finish creating your username.")
            return
          }

          // If signUp returned a session immediately, insert right away
          try {
            if (data.session) {
              await ensureUsernameForSession(data.session, username.trim().toLowerCase(), email)
            }
          } finally {
            try { if (typeof window !== "undefined") localStorage.removeItem("medius_pending_username") } catch {}
            try { if (typeof window !== "undefined") localStorage.removeItem("medius_pending_email") } catch {}
            try { if (typeof window !== "undefined") localStorage.removeItem("medius_ref_code") } catch {}
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                const { data: row } = await supabase.from("usernames").select("id").eq("user_id", session.user.id).maybeSingle()
                router.replace(row ? "/dashboard" : "/onboarding/username")
                return
              }
            } catch {}
          }
          return
        }

        // If no username provided, surface sign-in error
        throw signInErr
      } else {
        // Magic link flow — we cannot insert username because there is no session yet.
        // Save pending values so callback can finish the insertion.
        const finalUsername = username.trim().toLowerCase()
        const finalEmail = email.trim()
        console.log('handleEmailSubmit: saving pending data for magic link:', { finalUsername, finalEmail })
        try { localStorage.setItem('medius_pending_username', finalUsername) } catch {}
        try { localStorage.setItem('medius_pending_email', finalEmail) } catch {}

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callbackUrl },
        })
        if (error) throw error
        setMessage("Check your email for a sign-in link. After you follow the link we'll finish creating your username.")
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: "google" | "discord") => {
    setError(null)
    setLoading(true)
    try {
      if (username.trim()) {
        const finalUsername = username.trim().toLowerCase()
        console.log('handleOAuth: saving pending username for OAuth:', finalUsername)
        try { localStorage.setItem('medius_pending_username', finalUsername) } catch {}
      }
      if (email.trim()) {
        const finalEmail = email.trim()
        console.log('handleOAuth: saving pending email for OAuth:', finalEmail)
        try { localStorage.setItem('medius_pending_email', finalEmail) } catch {}
      }
      const codeFromUrl = searchParams.get('ref')?.trim()
      if (codeFromUrl) {
        try { localStorage.setItem('medius_ref_code', codeFromUrl) } catch {}
      }
    } catch {}

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const inputBase =
    "h-12 w-full rounded-md border border-white/10 bg-[#111111] px-3 text-[16px] text-white " +
  "placeholder:text-[16px] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40"

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,149,0,0.25),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_100%,rgba(255,149,0,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.65)_45%,rgba(0,0,0,0.95)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0c]/95 p-8 shadow-[0_10px_60px_rgba(255,149,0,0.25)]">
        <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center">
          <Image src="/images/image.png" alt="Logo" width={32} height={32} className="h-8 w-8 object-contain" priority />
        </div>

        <h1 className="text-center text-2xl font-semibold">Create an account</h1>

        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              placeholder="Your email"
            />
          </div>
          <div>
            <div className="flex group">
              <span className="relative inline-flex h-12 items-center rounded-l-md border border-r-0 border-white/10 bg-[#111111] px-3 text-[16px] text-gray-400 after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-white/10 after:transition-colors group-focus-within:after:bg-orange-500/50">
                medius.com/
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${inputBase} rounded-l-none border-l-0 focus:ring-orange-500/40`}
                placeholder="username"
              />
            </div>
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBase}
              placeholder="Password (to sign in or create account)"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-orange-500 text-[15px] font-semibold text-white hover:bg-orange-500/90 disabled:opacity-50"
          >
            {loading ? "Working..." : "Continue"}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/20" />
          <span className="text-[11px] tracking-widest text-white/60">OR</span>
          <div className="h-px flex-1 bg-black/20" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleOAuth("discord")}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#5865F2] px-3 text-[15px] font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 245 240" fill="currentColor">
              <path d="M104.4 104.9c-5.7 0-10.2 5-10.2 11.1s4.6 11.1 10.2 11.1c5.7 0 10.2-5 10.2-11.1s-4.5-11.1-10.2-11.1z"/>
              <path d="M189.5 20h-134A35.6 35.6 0 0020 55.6v128.7A35.6 35.6 0 0055.6 220h115.4l-5.4-18.7 13.1 12.1 12.4 11.4 22.4 20v-44.7l-.1-1.1V55.6A35.6 35.6 0 00189.5 20z"/>
            </svg>
            Discord
          </button>

          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-black text-[15px] font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.4 32.4 29 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3.1 0 6 1.2 8.2 3.2l5.7-5.7C34.1 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.1-.4-3.1z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.2 16 18.7 12 24 12c3.1 0 6 1.2 8.2 3.2l5.7-5.7C34.1 6 29.3 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5 0 9.7-1.9 13.2-5l-6.1-5c-2 1.4-4.6 2.2-7.1 2.2-5 0-9.3-3.6-10.7-8.4l-6.6 5.1C9.3 39.6 16.1 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 3.1-3.4 5.6-6.3 6.9l.1.1 6.1 5C38 37.7 40 32.1 40 26c0-1.1-.1-2.1-.4-3.1z"/>
            </svg>
            Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          By signing up, you agree to our <span className="text-white/80">Terms</span> & <span className="text-white/80">Privacy</span>
        </p>
      </div>
    </div>
  )
}
