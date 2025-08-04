"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push("/dashboard")
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        })
        if (error) throw error

        if (data.user && !data.user.email_confirmed_at) {
          setShowEmailConfirmation(true)
        } else if (data.user) {
          const { error: profileError } = await supabase.from("profiles").update({ username }).eq("id", data.user.id)
          if (profileError) throw profileError
          router.push("/dashboard")
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center p-4">
        {/* Subtle animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-float-slow-reverse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-400/8 rounded-full blur-2xl animate-float-gentle"></div>

        <div className="max-w-md w-full relative z-10 animate-fade-in-up">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm border border-orange-400/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform duration-300 ease-out">
                  <svg
                    className="w-10 h-10 text-orange-400 animate-fade-in"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 animate-slide-in-left">Check Your Email</h2>
                <p className="text-gray-300/80 mb-6 animate-slide-in-right">
                  We've sent a confirmation link to <span className="text-orange-400 font-medium">{email}</span>
                </p>
              </div>

              <div className="space-y-6">
                <div className="backdrop-blur-sm bg-blue-500/10 border border-blue-400/20 rounded-2xl p-6 animate-slide-in-up hover:bg-blue-500/15 hover:border-blue-400/30 transition-all duration-300 ease-out">
                  <h3 className="text-blue-300 font-medium mb-3 flex items-center space-x-2">
                    <span className="animate-bounce-gentle">✨</span>
                    <span>What's next?</span>
                  </h3>
                  <ul className="text-sm text-blue-200/80 space-y-2">
                    <li className="flex items-center space-x-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <span>Check your email inbox (and spam folder)</span>
                    </li>
                    <li className="flex items-center space-x-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <span>Click the confirmation link</span>
                    </li>
                    <li className="flex items-center space-x-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      <span>You'll be automatically signed in</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowEmailConfirmation(false)}
                  className="w-full py-4 px-6 backdrop-blur-sm bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white font-medium rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] transform ease-out"
                >
                  Back to Sign Up
                </button>
              </div>

              <div className="mt-8 flex items-center justify-center animate-fade-in" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center text-sm text-gray-400">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-glow-gentle"></div>
                  Secure Email Verification
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-black to-amber-500/8"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-float-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-float-slow-reverse"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-400/8 rounded-full blur-2xl animate-float-gentle"></div>

      <div className="max-w-md w-full relative z-10 animate-fade-in-up">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 relative overflow-hidden hover:border-white/15 hover:bg-white/8 transition-all duration-500 ease-out">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"></div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-8 text-center text-white animate-slide-in-down">
              {isLogin ? "Welcome Back" : "Join Us"}
            </h2>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="animate-slide-in-left" style={{ animationDelay: "0.1s" }}>
                <label className="block text-sm font-medium text-gray-300 mb-3">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                  placeholder="Enter your email"
                  required
                />
              </div>

              {!isLogin && (
                <div className="animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-4 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                    placeholder="Choose a username"
                    required
                  />
                </div>
              )}

              <div className="animate-slide-in-left" style={{ animationDelay: isLogin ? "0.2s" : "0.3s" }}>
                <label className="block text-sm font-medium text-gray-300 mb-3">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 backdrop-blur-sm bg-white/10 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/15 transition-all duration-300 ease-out hover:bg-white/12"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="backdrop-blur-sm bg-red-500/10 border border-red-400/20 text-red-300 px-4 py-4 rounded-2xl text-sm animate-shake">
                  <div className="flex items-center space-x-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-orange-500/80 to-amber-500/80 hover:from-orange-500 hover:to-amber-500 backdrop-blur-sm border border-orange-400/30 text-white font-semibold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:shadow-xl hover:scale-[1.02] transform ease-out relative overflow-hidden group animate-slide-in-up"
                style={{ animationDelay: isLogin ? "0.3s" : "0.4s" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10">
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Loading...
                    </div>
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </div>
              </button>
            </form>

            <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-orange-400 hover:text-orange-300 transition-colors duration-300 text-sm font-medium hover:scale-105 transform ease-out"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center animate-fade-in" style={{ animationDelay: "0.7s" }}>
              <div className="flex items-center text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-glow-gentle"></div>
                All systems operational
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
