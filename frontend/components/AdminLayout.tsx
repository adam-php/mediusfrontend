"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, FileText, CreditCard, TrendingUp, Shield, Settings, LogOut, Activity } from "lucide-react"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [checking, setChecking] = useState<boolean>(true)

  useEffect(() => {
    if (!pendingHref) return
    const isDashboard = pendingHref === "/admin"
    const hasArrived = isDashboard
      ? pathname === "/admin" || pathname.startsWith("/admin/")
      : pathname.startsWith(pendingHref)
    if (hasArrived) setPendingHref(null)
  }, [pathname, pendingHref])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: sessionResp } = await supabase.auth.getSession()
        const token = sessionResp.session?.access_token
        if (!token) {
          setIsAdmin(false)
        } else {
          // Primary: backend profile endpoint (service key, reliable role)
          const profRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/me`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
            cache: 'no-store',
          })
          if (cancelled) return
          if (profRes.ok) {
            const prof = await profRes.json()
            if (prof?.role === 'admin') {
              setIsAdmin(true)
              return
            }
            // Not admin per profile: double-check by hitting a protected admin endpoint
            const over = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
              cache: 'no-store',
            })
            setIsAdmin(over.status === 200)
          } else {
            // Fallback: access-check, then final try overview
            const acc = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/access-check`, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
              cache: 'no-store',
            })
            if (acc.status === 200) {
              setIsAdmin(true)
            } else {
              const over = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/overview`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
                cache: 'no-store',
              })
              setIsAdmin(over.status === 200)
            }
          }
        }
      } catch (e) {
        setIsAdmin(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: Activity },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Escrows", href: "/admin/escrows", icon: FileText },
    { name: "Referrals", href: "/admin/referrals", icon: TrendingUp },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ] as const

  if (checking || isAdmin === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center space-x-3 text-white">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg">Checking access...</span>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    // Fire-and-forget IP log to backend (already logged by access-check when called without admin)
    // Additional explicit log to capture path context from client
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/forbidden-admin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ path: pathname }),
          credentials: "include",
        })
      } catch {}
    })()

    const payload = { error: 'forbidden', status: 403, path: pathname }
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <pre className="text-sm">{JSON.stringify(payload, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 min-h-screen">
          <nav className="p-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isDashboard = item.href === "/admin"
              const isActive = isDashboard
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setPendingHref(item.href)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-orange-500/20 text-orange-300 border border-orange-400/30"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {pendingHref === item.href && (
                    <span className="ml-auto inline-block w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </Link>
              )
            })}

            <div className="pt-6 mt-6 border-t border-white/10">
              <button className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors w-full">
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
