"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    const run = async () => {
      console.log('AuthCallback: Starting callback flow')

      // Wait for session
      let { data: { session } } = await supabase.auth.getSession()
      console.log('AuthCallback: Initial session check:', session ? 'session found' : 'no session')

      if (!session) {
        console.log('AuthCallback: Waiting 200ms for session...')
        await new Promise((r) => setTimeout(r, 200))
        const res = await supabase.auth.getSession()
        session = res.data.session
        console.log('AuthCallback: Session after wait:', session ? 'session found' : 'still no session')
      }

      if (!session) {
        console.log('AuthCallback: No session found, redirecting to auth')
        router.replace("/auth")
        return
      }

      console.log('AuthCallback: Session user:', {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata
      })

      // Claim referral early; it doesn't depend on username
      try {
        const codeFromUrl = searchParams.get("ref")?.trim() || ""
        const codeFromStorage = typeof window !== "undefined" ? (localStorage.getItem("medius_ref_code") || "") : ""
        const code = (codeFromUrl || codeFromStorage).trim()
        console.log('AuthCallback: Referral code handling:', { codeFromUrl, codeFromStorage, finalCode: code })

        if (code) {
          console.log('AuthCallback: Claiming referral code:', code)
          const response = await fetch(`${API_URL}/api/referrals/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              "ngrok-skip-browser-warning": "1",
            },
            body: JSON.stringify({ code }),
          })
          console.log('AuthCallback: Referral claim response:', response.status)
        }
      } catch (e) {
        console.warn("AuthCallback: Referral claim failed", e)
      } finally {
        try { localStorage.removeItem("medius_ref_code") } catch {}
      }

      // Check if user already has a username on profiles
      console.log('AuthCallback: Checking existing profile for user:', session.user.id)
      const { data: existing, error: existingErr } = await supabase
        .from("profiles")
        .select("id, username, email")
        .eq("id", session.user.id)
        .maybeSingle()

      if (existingErr) {
        console.warn('AuthCallback: Error checking existing profile:', existingErr)
      } else {
        console.log('AuthCallback: Existing profile data:', existing)
      }

      if (existing?.username) {
        console.log('AuthCallback: User already has username, redirecting to dashboard')
        router.replace("/dashboard")
        return
      }

      // Try finishing from pending username
      let pendingUsername = ""
      let pendingEmail = ""
      try {
        pendingUsername = localStorage.getItem("medius_pending_username") || ""
        pendingEmail = localStorage.getItem("medius_pending_email") || ""
      } catch (e) {
        console.warn('AuthCallback: Error reading localStorage:', e)
      }

      console.log('AuthCallback: Pending data from localStorage:', {
        pendingUsername,
        pendingEmail
      })

      if (pendingUsername) {
        console.log('AuthCallback: Processing pending username:', {
          username: pendingUsername,
          email: pendingEmail,
          sessionEmail: session.user.email
        })

        const finalEmail = pendingEmail || session.user.email || null
        console.log('AuthCallback: Final email to store:', finalEmail)

        const { error: insertErr } = await supabase.from("profiles").upsert({
          id: session.user.id,
          username: pendingUsername.trim().toLowerCase(),
          email: finalEmail,
        }, { onConflict: 'id' })

        console.log('AuthCallback: Profile upsert result:', insertErr ? 'error' : 'success')
        if (insertErr) {
          console.warn('AuthCallback: Profile upsert error:', insertErr)
        }

        try { localStorage.removeItem("medius_pending_username") } catch {}
        try { localStorage.removeItem("medius_pending_email") } catch {}

        if (!insertErr) {
          console.log('AuthCallback: Profile created successfully, redirecting to dashboard')
          router.replace("/dashboard")
          return
        }

        // If it's a duplicate, push to the username screen with an error flag
        if (insertErr.code === "23505" || insertErr.message?.toLowerCase().includes("duplicate")) {
          console.log('AuthCallback: Username taken, redirecting to onboarding with error')
          router.replace("/onboarding/username?e=taken")
          return
        }

        // Any other error, let them pick manually
        console.log('AuthCallback: Other error, redirecting to onboarding')
        router.replace("/onboarding/username")
        return
      }

      // No pending username, no existing username -> force pick screen
      console.log('AuthCallback: No username data found, redirecting to onboarding')
      router.replace("/onboarding/username")
    }

    run().catch((err) => {
      console.error('AuthCallback: Unhandled error in callback flow:', err)
      router.replace("/auth")
    }).finally(() => setBusy(false))
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <p className="text-sm text-white/60">{busy ? "Finishing sign-in..." : ""}</p>
    </div>
  )
}


