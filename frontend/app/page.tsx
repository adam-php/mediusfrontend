"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (user) {
        router.push("/dashboard")
      } else {
        // Redirect to your landing page subdomain
        window.location.href = "https://mediusapp.netlify.app"
      }
    }
    
    checkUser()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
      <div className="flex items-center space-x-3 text-white">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-lg">Redirecting...</span>
      </div>
    </div>
  )
}