"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <nav className="backdrop-blur-xl bg-black/20 border-b border-white/10 text-white p-4 sticky top-0 z-50 relative animate-slide-in-down">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5"></div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent"></div>

      <div className="container mx-auto flex justify-between items-center relative z-10">
        <Link
          href="/"
          className="text-xl font-bold text-white hover:text-orange-400 transition-all duration-300 ease-out hover:scale-105 transform"
        >
          <div className="flex items-center space-x-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Image
                src="/images/image.png"
                alt="Medius Logo"
                width={32}
                height={32}
                className="rounded-full relative z-10 border border-orange-400/30 group-hover:border-orange-400/50 transition-colors duration-300"
              />
            </div>
            <span className="bg-gradient-to-r from-white to-orange-200 bg-clip-text text-transparent">
              Medius
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-6">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-orange-400 transition-all duration-300 font-medium relative group px-3 py-2 rounded-lg hover:scale-105 transform ease-out"
              >
                <span className="relative z-10">Dashboard</span>
                <div className="absolute inset-0 bg-orange-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100"></div>
              </Link>
              <Link
                href="https://discord.gg/8pzvCMVz"
                className="text-gray-300 hover:text-orange-400 transition-all duration-300 font-medium relative group px-3 py-2 rounded-lg hover:scale-105 transform ease-out"
              >
                <span className="relative z-10">Contact Us</span>
                <div className="absolute inset-0 bg-orange-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-95 group-hover:scale-100"></div>
              </Link>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400 backdrop-blur-sm bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:bg-white/8 hover:border-white/15 transition-all duration-300 ease-out">
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:scale-105 transform ease-out"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/auth"
              className="backdrop-blur-sm bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 hover:border-orange-400/50 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:scale-105 transform ease-out"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
