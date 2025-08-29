"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

  useEffect(() => {
    let mounted = true
    const run = async () => {
      // Wait for Supabase to finalize the session after OAuth redirect
      let tries = 0
      let session = null as any
      while (tries < 20 && mounted) {
        const { data } = await supabase.auth.getSession()
        session = data.session
        if (session) break
        await new Promise((r) => setTimeout(r, 200))
        tries++
      }

      try {
        const codeFromUrl = searchParams.get("ref")?.trim() || ""
        const codeFromStorage = typeof window !== "undefined" ? (localStorage.getItem("medius_ref_code") || "") : ""
        const code = (codeFromUrl || codeFromStorage || "").trim()
        if (session && code) {
          await fetch(`${API_URL}/api/referrals/claim?ngrok-skip-browser-warning=true`, {
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
        router.replace("/dashboard")
      }
    }
    run()
    return () => { mounted = false }
  }, [router, searchParams, API_URL])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex items-center space-x-3">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span>Finalizing sign-in…</span>
      </div>
    </div>
  )
}


