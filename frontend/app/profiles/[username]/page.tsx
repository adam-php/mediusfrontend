"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const p = await params
      setUsername(p.username)
    })()
  }, [params])

  useEffect(() => {
    if (!username) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${encodeURIComponent(username)}`)
        if (!res.ok) throw new Error((await res.json()).error || "User not found")
        const data = await res.json()
        setProfile(data)

        const fr = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${encodeURIComponent(username)}/friends`)
        const frData = fr.ok ? await fr.json() : []
        setFriends(frData || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [username])

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined" || !profile?.username) return ""
    return `${window.location.origin}/profiles/${profile.username}`
  }, [profile?.username])

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  const startEscrow = (role: "buyer" | "seller") => {
    router.push(`/create-escrow?role=${role}&to=${profile.username}`)
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
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold">@{profile.username}</div>
              {profile.display_name && (
                <div className="text-gray-300">{profile.display_name}</div>
              )}
              {profile.bio && <div className="text-sm text-gray-400 mt-1">{profile.bio}</div>}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => startEscrow("buyer")}
              className="rounded-2xl bg-gradient-to-r from-orange-500/80 to-amber-500/80 px-6 py-3 font-semibold hover:from-orange-500 hover:to-amber-500"
            >
              Create Escrow (I’m the buyer)
            </button>
            <button
              onClick={() => startEscrow("seller")}
              className="rounded-2xl bg-white/10 border border-white/20 px-6 py-3 font-semibold hover:bg-white/15"
            >
              Create Escrow (I’m the seller)
            </button>
            <button
              onClick={() => publicUrl && copy(publicUrl)}
              className="ml-auto rounded-2xl bg-white/10 border border-white/20 px-4 py-3 hover:bg-white/15"
            >
              Copy Profile URL
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Friends</h2>
            <div className="text-sm text-gray-400">{friends.length} total</div>
          </div>
          {friends.length === 0 ? (
            <div className="text-gray-400 text-sm mt-2">No friends to show.</div>
          ) : (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {friends.map((f) => (
                <a key={f.id} href={`/profiles/${f.username}`} className="rounded-xl border border-white/15 bg-white/5 p-3 hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                      {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : <span>👤</span>}
                    </div>
                    <div>
                      <div className="font-semibold">@{f.username}</div>
                      {f.display_name && <div className="text-xs text-gray-400">{f.display_name}</div>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}