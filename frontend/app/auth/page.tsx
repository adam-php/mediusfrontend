"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

type Mode = "signin" | "signup"

const USERNAME_REGEX = /^[a-z0-9_]{3,50}$/

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get("mode") as Mode) || "signup"
  const [mode, setMode] = useState<Mode>(initialMode)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

  const callbackUrl = useMemo(() => `${window.location.origin}/auth/callback`, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard")
    })
  }, [router])

  useEffect(() => {
    if (mode !== "signup") return
    const uname = username.trim().toLowerCase()

    setUsernameAvailable(null)
    if (!USERNAME_REGEX.test(uname)) {
      setCheckingUsername(false)
      return
    }

    let cancelled = false
    setCheckingUsername(true)
    const t = setTimeout(async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("username", uname)

      if (cancelled) return
      if (error) {
        console.warn("Username check error:", error)
        setUsernameAvailable(null)
      } else {
        setUsernameAvailable((count ?? 0) === 0)
      }
      setCheckingUsername(false)
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [username, mode])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace("/dashboard")
      } else {
        const uname = username.trim().toLowerCase()

        if (!USERNAME_REGEX.test(uname)) {
          setLoading(false)
          setError("Username must be 3–50 chars, lowercase letters, numbers, or underscores.")
          return
        }

        const { count, error: checkErr } = await supabase
          .from("profiles")
          .select("id", { head: true, count: "exact" })
          .eq("username", uname)

        if (checkErr) {
          setLoading(false)
          setError("Could not verify username availability. Please try again.")
          return
        }
        if ((count ?? 0) > 0) {
          setLoading(false)
          setError("Username is already taken.")
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
            data: { username: uname },
          },
        })
        if (error) throw error

        if (!data.session) {
          setMessage("Check your email to confirm your account.")
        } else {
          router.replace("/dashboard")
        }
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  // Larger inputs + placeholders
  const inputBase =
    "h-12 w-full rounded-md border border-white/10 bg-[#111111] px-3 text-[16px] text-white " +
    "placeholder:text-[16px] placeholder:text-gray-400/90 focus:outline-none focus:ring-2 focus:ring-orange-500/40"

  const canSubmitSignup =
    mode === "signin" ||
    (USERNAME_REGEX.test(username) &&
      usernameAvailable !== false &&
      !checkingUsername)

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white overflow-hidden">
      {/* Background glow/vignette */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full blur-3xl bg-[radial-gradient(closest-side,rgba(255,149,0,0.25),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_100%,rgba(255,149,0,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.65)_45%,rgba(0,0,0,0.95)_100%)]" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0c]/95 p-8 shadow-[0_10px_60px_rgba(255,149,0,0.25)]">
        {/* Logo image */}
        <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center">
          <Image src="/images/image.png" alt="Logo" width={32} height={32} className="h-8 w-8 object-contain" priority />
        </div>

        <h1 className="text-center text-2xl font-semibold">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>

        {/* OAuth buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white text-[15px] font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50"
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

        {/* Divider */}
        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] tracking-widest text-gray-400">OR WITH EMAIL</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Form */}
        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm text-gray-300">Username</label>
              <div className="flex">
                {/* Prefix with inner vertical divider */}
                <span className="relative inline-flex h-12 items-center rounded-l-md border border-r-0 border-white/10 bg-[#111111] px-3 text-[16px] text-gray-400 after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-white/10">
                  hello.com/
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className={`${inputBase} rounded-l-none border-l-0`}
                  placeholder="username"
                  minLength={3}
                  pattern="[a-z0-9_]+"
                  title="Use 3–50 chars: lowercase letters, numbers, and underscores"
                />
              </div>
              <div className="mt-1 text-xs">
                {checkingUsername && USERNAME_REGEX.test(username) && (
                  <span className="text-gray-400">Checking…</span>
                )}
                {!checkingUsername && username && USERNAME_REGEX.test(username) && usernameAvailable === true && (
                  <span className="text-green-400">Available</span>
                )}
                {!checkingUsername && username && USERNAME_REGEX.test(username) && usernameAvailable === false && (
                  <span className="text-red-400">Already taken</span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBase}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}

          {/* Slightly lighter orange CTA */}
          <button
            type="submit"
            disabled={loading || (mode === "signup" && !canSubmitSignup)}
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-md bg-orange-500 text-[15px] font-semibold text-white hover:bg-orange-500/90 disabled:opacity-50"
          >
            {loading ? (mode === "signin" ? "Signing in..." : "Creating...") : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-gray-400">
          {mode === "signin" ? (
            <>
              Don’t have an account?{" "}
              <button onClick={() => setMode("signup")} className="text-orange-400 hover:text-orange-300">
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("signin")} className="text-orange-400 hover:text-orange-300">
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}