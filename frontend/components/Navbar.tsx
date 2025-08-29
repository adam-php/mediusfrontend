"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname()
  const isFetchingRef = useRef(false)
  const lastTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      const token = session?.access_token
      if (token) {
        await fetchUserProfile(token)
      }
    }
    boot()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore token refresh events to avoid duplicate fetches
      if (event === 'TOKEN_REFRESHED') return
      setUser(session?.user ?? null)
      const token = session?.access_token ?? null
      if (token) {
        fetchUserProfile(token)
      } else {
        lastTokenRef.current = null
        setUserProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (accessToken: string) => {
    try {
      if (isFetchingRef.current) return
      if (lastTokenRef.current === accessToken) return
      isFetchingRef.current = true
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/me?ngrok-skip-browser-warning=true`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ngrok-skip-browser-warning': '1',
        },
        // Cache for a bit to prevent repetitive requests across navigations
        cache: 'no-store',
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          const text = await response.text()
          console.warn('Non-JSON response for profile/me:', text.slice(0, 80))
          return
        }
        const data = await response.json()
        setUserProfile(data)
        lastTokenRef.current = accessToken
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      isFetchingRef.current = false
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const NavLinks = () => (
    <>
      {/* Hide Dashboard on mobile */}
      <Link
        href="/dashboard"
        className="hidden md:inline-flex text-gray-300 hover:text-orange-400 transition-all duration-300 font-medium relative group px-3 py-2 rounded-lg md:hover:scale-105 active:scale-[0.98] ease-out"
      >
        <span className="relative z-10">Dashboard</span>
        <div className="hidden md:block absolute inset-0 bg-orange-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100" />
      </Link>
      {userProfile?.role === 'admin' && (
        <Link
          href="/admin"
          className="hidden md:inline-flex text-gray-300 hover:text-orange-400 transition-all duration-300 font-medium relative group px-3 py-2 rounded-lg md:hover:scale-105 active:scale-[0.98] ease-out"
        >
          <span className="relative z-10">Admin</span>
          <div className="hidden md:block absolute inset-0 bg-orange-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100" />
        </Link>
      )}
      <Link
        href="https://discord.gg/8pzvCMVz"
        className="text-gray-300 hover:text-orange-400 transition-all duration-300 font-medium relative group px-3 py-2 rounded-lg md:hover:scale-105 active:scale-[0.98] ease-out"
      >
        <span className="relative z-10">Contact Us</span>
        <div className="hidden md:block absolute inset-0 bg-orange-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100" />
      </Link>
    </>
  )

  return (
    <nav className="backdrop-blur-xl bg-black/20 text-white p-3 sm:p-4 sticky top-0 z-50 relative animate-slide-in-down">
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0.00) 40%, rgba(251,146,60,0.06) 100%)" }} />
      {pathname === "/dashboard" && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 w-[50vw] h-[50vh] md:-top-32 md:-left-40 md:w-[48rem] md:h-[48rem] rounded-full bg-orange-500/35 blur-[120px] md:blur-[180px] mix-blend-screen"
        />
      )}

      <div className="container mx-auto flex justify-between items-center relative z-10">
        {/* Brand */}
        <Link
          href="/"
          className="text-xl font-bold text-white transition-all duration-300 ease-out md:hover:scale-105 active:scale-[0.98] transform"
        >
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Image
                src="/images/image.png"
                alt="Medius Logo"
                width={32}
                height={32}
                className="rounded-full relative z-10 border border-orange-400/30 group-hover:border-orange-400/50 transition-colors duration-300"
              />
            </div>
            <span className="text-white">Medius</span>
          </div>
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center space-x-6">
          {user ? (
            <>
              <NavLinks />
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400 backdrop-blur-sm bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:bg-white/8 hover:border-white/15 transition-all duration-300 ease-out">
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 md:hover:scale-105 active:scale-[0.98] transform ease-out"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/auth"
              className="backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 md:hover:scale-105 active:scale-[0.98] transform ease-out"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile actions: keep only Login/Logout; no drawer, no Dashboard on mobile */}
        <div className="flex items-center space-x-2 md:hidden">
          {user ? (
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white transition-all duration-300"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white transition-all duration-300"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}