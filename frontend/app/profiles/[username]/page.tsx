"use client"

import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function PublicProfilePage({ params }: { params: { username: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<any>(null)
  const [imageError, setImageError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const username = params?.username
    if (!username) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${encodeURIComponent(username)}`)
        if (!res.ok) throw new Error((await res.json()).error || "User not found")
        const data = await res.json()
        setProfile(data)

        // Friends feature removed
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [params?.username])

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined" || !profile?.username) return ""
    return `${window.location.origin}/profiles/${profile.username}`
  }, [profile?.username])

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return ""
    try {
      const d = new Date(profile.created_at)
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    } catch { return "" }
  }, [profile?.created_at])

  const initials = useMemo(() => {
    const source = (profile?.display_name || profile?.username || "").trim()
    if (!source) return ""
    const parts = source.split(/\s+/).slice(0, 2)
    return parts.map((p: string) => p[0]?.toUpperCase()).join("")
  }, [profile?.display_name, profile?.username])

  const showImage = Boolean(profile?.avatar_url && !imageError)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const BlockButton = ({ username, className = "" }: { username: string, className?: string }) => {
    const onBlock = async () => {
      if (!confirm(`Block @${username}? They won't be able to interact with you.`)) return
      try {
        setBlocking(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          window.location.href = "/auth"
          return
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${encodeURIComponent(username)}/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'block' })
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Failed to block user')
        }
        setBlocked(true)
      } catch (e) {
        alert((e as any)?.message || 'Failed to block user')
      } finally {
        setBlocking(false)
      }
    }

    return (
      <button
        onClick={onBlock}
        disabled={blocking || blocked}
        className={`${className} rounded-2xl px-4 py-3 text-sm font-medium transition-colors border ${
          blocked
            ? 'bg-red-500/20 border-red-500/40 text-red-300'
            : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/15'
        } disabled:opacity-60`}
      >
        {blocked ? 'Blocked' : (blocking ? 'Blocking…' : 'Block')}
      </button>
    )
  }

  const startEscrow = () => {
    router.push(`/create-escrow?to=${profile.username}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading profile…</span>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-5xl mb-2">⚠️</div>
          <p className="text-gray-300">{error || "User not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-xl border border-white/10 shadow-sm">
                {showImage ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center bg-gradient-to-br from-zinc-800 to-zinc-700 text-white/90">
                    <span>{initials || "👤"}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className="text-lg font-semibold">{profile.display_name ?? "Unnamed"}</div>
              <div className="text-sm text-gray-400 mt-1">@{profile.username}</div>
              {memberSince && (
                <div className="text-xs text-gray-500 mt-2">Member since {memberSince}</div>
              )}
              {profile.bio && <div className="text-sm text-gray-400 mt-3">{profile.bio}</div>}
            </div>
          </div>

          <div className="mt-6 flex gap-3 items-center">
            <button
              onClick={startEscrow}
              className="rounded-2xl bg-[#FF7A00] hover:bg-[#FF7A00] px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/20"
            >
              Create Escrow
            </button>
            <BlockButton username={profile.username} className="ml-auto" />
          </div>
        </div>

        {/* Deal stats */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="text-sm text-gray-300 mb-2">Deal stats</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Completed escrows</div>
              <div className="mt-1 text-xl font-semibold">{profile?.stats?.completed ?? 0}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Active escrows</div>
              <div className="mt-1 text-xl font-semibold">{profile?.stats?.active ?? 0}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Total escrows</div>
              <div className="mt-1 text-xl font-semibold">{profile?.stats?.total ?? 0}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Total completed volume (USD)</div>
              <div className="mt-1 text-xl font-semibold">${((profile?.stats?.volume_usd ?? 0) as number).toLocaleString('en-US')}</div>
            </div>
          </div>
        </div>

        {/* Friends section removed */}
      </div>
    </div>
  )
}