"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type BaseNotification = { id: string; created_at: string; escrowId: string }
type EscrowNotification = BaseNotification & {
  kind: "escrow"
  otherUserId: string
  title?: string | null
  amount?: number | null
  currency?: string | null
}
type MessageNotification = BaseNotification & {
  kind: "message"
  senderId: string
  message: string
}
type NotificationItem = EscrowNotification | MessageNotification

type ProfileLite = { id: string; username?: string | null; avatar_url?: string | null }

export default function NotificationsButton() {
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const myEscrowIdsRef = useRef<Set<string>>(new Set())
  const profilesCacheRef = useRef<Map<string, ProfileLite>>(new Map())
  const messageChannelNamesRef = useRef<Set<string>>(new Set())
  const lastSeenKey = useMemo(
    () => (userId ? `notifications:lastSeen:${userId}` : "notifications:lastSeen"),
    [userId],
  )

  const lastSeenRef = useRef<number>(0)

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const raw = typeof window !== "undefined" ? window.localStorage.getItem(lastSeenKey) : null
      lastSeenRef.current = raw ? Number(raw) || 0 : 0

      await fetchInitial(user.id)
      setupRealtime(user.id)
    }
    init()

    return () => {
      try {
        supabase.getChannels().forEach((c) => {
          if (c.topic.startsWith("realtime:notifications-")) c.unsubscribe()
        })
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const fetchInitial = async (uid: string) => {
    try {
      setLoading(true)
      // 1) Get escrows involving the user
      const { data: escrows, error: escErr } = await supabase
        .from("escrows")
        .select("id,title,amount,currency,buyer_id,seller_id,created_at")
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(50)
      if (escErr) throw escErr

      const escrowIds = new Set<string>((escrows || []).map((e: any) => e.id))
      myEscrowIdsRef.current = escrowIds

      // Prepare escrow notifications (treat as new if after lastSeen)
      const escrowNotifs: EscrowNotification[] = (escrows || []).map((e: any) => ({
        id: `escrow-${e.id}`,
        kind: "escrow",
        created_at: e.created_at,
        escrowId: e.id,
        otherUserId: e.buyer_id === uid ? e.seller_id : e.buyer_id,
        title: e.title,
        amount: e.amount,
        currency: e.currency,
      }))

      // 2) Get latest messages across those escrows (not from current user)
      let messageNotifs: MessageNotification[] = []
      if (escrowIds.size > 0) {
        const idArray = Array.from(escrowIds)
        const { data: msgs, error: msgErr } = await supabase
          .from("escrow_messages")
          .select("id,escrow_id,sender_id,message,message_type,created_at")
          .in("escrow_id", idArray)
          .order("created_at", { ascending: false })
          .limit(80)
        if (msgErr) throw msgErr

        messageNotifs = (msgs || [])
          .filter((m: any) => m.sender_id !== uid)
          .map((m: any) => ({
            id: `msg-${m.id}`,
            kind: "message",
            created_at: m.created_at,
            escrowId: m.escrow_id,
            senderId: m.sender_id,
            message: String(m.message || ""),
          }))
      }

      const all = [...escrowNotifs, ...messageNotifs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50)
      setItems(all)

      const actorIds = new Set<string>()
      all.forEach((n) => {
        if (n.kind === "escrow") actorIds.add(n.otherUserId)
        else actorIds.add(n.senderId)
      })
      await ensureProfiles(Array.from(actorIds))

      const hasNew = all.some((n) => new Date(n.created_at).getTime() > (lastSeenRef.current || 0))
      setHasUnread(hasNew)

      // Subscribe to messages for each escrow id
      for (const id of escrowIds) subscribeToEscrowMessages(uid, id)
    } catch (e) {
      console.error("Failed to load notifications:", e)
    } finally {
      setLoading(false)
    }
  }

  const ensureProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profilesCacheRef.current.has(id))
    if (missing.length === 0) return
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,avatar_url")
        .in("id", missing)
      if (error) throw error
      ;(data || []).forEach((p: any) => {
        profilesCacheRef.current.set(p.id, p)
      })
    } catch (e) {
      console.warn("Failed to fetch profiles for notifications", e)
    }
  }

  const setupRealtime = (uid: string) => {
    try {
      const chanEscrows = supabase
        .channel(`notifications-escrows-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "escrows", filter: `buyer_id=eq.${uid}` },
          async (payload) => {
            const e: any = payload.new
            myEscrowIdsRef.current.add(e.id)
            subscribeToEscrowMessages(uid, e.id)
            const notif: EscrowNotification = {
              id: `escrow-${e.id}`,
              kind: "escrow",
              created_at: e.created_at,
              escrowId: e.id,
              otherUserId: e.seller_id,
              title: e.title,
              amount: e.amount,
              currency: e.currency,
            }
            await ensureProfiles([notif.otherUserId])
            setItems((prev) => [notif, ...prev].slice(0, 50))
            const ts = new Date(notif.created_at).getTime()
            if (ts > (lastSeenRef.current || 0)) setHasUnread(true)
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "escrows", filter: `seller_id=eq.${uid}` },
          async (payload) => {
            const e: any = payload.new
            myEscrowIdsRef.current.add(e.id)
            subscribeToEscrowMessages(uid, e.id)
            const notif: EscrowNotification = {
              id: `escrow-${e.id}`,
              kind: "escrow",
              created_at: e.created_at,
              escrowId: e.id,
              otherUserId: e.buyer_id,
              title: e.title,
              amount: e.amount,
              currency: e.currency,
            }
            await ensureProfiles([notif.otherUserId])
            setItems((prev) => [notif, ...prev].slice(0, 50))
            const ts = new Date(notif.created_at).getTime()
            if (ts > (lastSeenRef.current || 0)) setHasUnread(true)
          },
        )
        .subscribe()

      return () => {
        chanEscrows.unsubscribe()
        // message channels cleaned up via getChannels in unmount
      }
    } catch (e) {
      console.warn("Failed to setup realtime notifications", e)
    }
  }

  const subscribeToEscrowMessages = (uid: string, escrowId: string) => {
    const name = `notifications-msg-${uid}-${escrowId}`
    if (messageChannelNamesRef.current.has(name)) return
    messageChannelNamesRef.current.add(name)

    supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escrow_messages", filter: `escrow_id=eq.${escrowId}` },
        async (payload) => {
          const m: any = payload.new
          if (m.sender_id === uid) return
          const notif: MessageNotification = {
            id: `msg-${m.id}`,
            kind: "message",
            created_at: m.created_at,
            escrowId: m.escrow_id,
            senderId: m.sender_id,
            message: String(m.message || ""),
          }
          await ensureProfiles([notif.senderId])
          setItems((prev) => [notif, ...prev].slice(0, 50))
          const ts = new Date(notif.created_at).getTime()
          if (ts > (lastSeenRef.current || 0)) setHasUnread(true)
        },
      )
      .subscribe()
  }

  const markSeenNow = () => {
    try {
      const now = Date.now()
      lastSeenRef.current = now
      if (typeof window !== "undefined") window.localStorage.setItem(lastSeenKey, String(now))
      setHasUnread(false)
    } catch {}
  }

  const getUserDisplay = (id: string) => {
    const p = profilesCacheRef.current.get(id)
    return p?.username || "User"
  }

  if (!userId) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((s) => !s)
          // When opening, mark as seen
          if (!open) markSeenNow()
        }}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-white transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-black" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border border-white/15 bg-black/90 backdrop-blur-xl shadow-2xl p-2 z-50"
        >
          <div className="px-2 py-1.5 text-xs text-gray-400">Notifications</div>
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              <div className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading…</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">No notifications yet</div>
          ) : (
            <ul className="space-y-1">
              {items.slice(0, 20).map((n) => {
                const ts = new Date(n.created_at)
                const timeLabel = ts.toLocaleString()
                if (n.kind === "escrow") {
                  return (
                    <li key={n.id} className="rounded-xl hover:bg-white/5">
                      <Link
                        href={`/escrow/${n.escrowId}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 p-3 text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300">
                          ⚖️
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">
                            New escrow with <span className="text-orange-300">{getUserDisplay(n.otherUserId)}</span>
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {(n.title || `Escrow #${n.escrowId.slice(0, 8)}`) + (n.amount ? ` — ${n.amount} ${n.currency}` : "")}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{timeLabel}</div>
                        </div>
                      </Link>
                    </li>
                  )
                }

                return (
                  <li key={n.id} className="rounded-xl hover:bg-white/5">
                    <Link
                      href={`/escrow/${n.escrowId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 p-3 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                        💬
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white">
                          New message from <span className="text-blue-300">{getUserDisplay(n.senderId)}</span>
                        </div>
                        <div className="text-xs text-gray-400 truncate">{n.message}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{timeLabel}</div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}


