"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Escrow, Profile } from "@/lib/types"

export default function MessagesPage() {
  const searchParams = useSearchParams()
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || "", [])

  const [user, setUser] = useState<any>(null)
  const [escrow, setEscrow] = useState<Escrow | null>(null)
  const [buyerProfile, setBuyerProfile] = useState<Profile | null>(null)
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [escrows, setEscrows] = useState<Pick<Escrow, "id" | "buyer_id" | "seller_id" | "amount" | "currency" | "status" | "title" | "updated_at">[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatText, setChatText] = useState("")
  const chatRef = useRef<HTMLDivElement | null>(null)

  // Pre-escrow conversation state
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<any | null>(null)
  const [convOtherName, setConvOtherName] = useState<string | null>(null)
  const [convMessages, setConvMessages] = useState<any[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [convListLoading, setConvListLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          window.location.href = "/auth"
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (!apiBase) {
          setError("Missing NEXT_PUBLIC_API_URL env for API requests")
          return
        }

        // If a conversation id is present, load conversation mode first
        const initialConvId = searchParams.get("conversation") || searchParams.get("c")
        if (initialConvId) {
          await selectConversation(initialConvId)
        }

        // Load user's escrows list
        setListLoading(true)
        const uid = user?.id
        if (!uid) {
          setListLoading(false)
          setError("Missing user id.")
          return
        }
        const { data: list } = await supabase
          .from("escrows")
          .select("id,buyer_id,seller_id,amount,currency,status,title,updated_at")
          .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
          .order("updated_at", { ascending: false })
          .limit(50)
        setEscrows(list || [])
        setListLoading(false)

        // Determine active escrow id from query or default to first in list
        let initialId = searchParams.get("escrow") || searchParams.get("e") || searchParams.get("id")
        if (!initialId && list && list.length > 0) initialId = list[0].id
        if (initialId) {
          await selectEscrow(initialId)
          try {
        const url = new URL(window.location.href)
            url.searchParams.set("escrow", initialId)
            window.history.replaceState({}, "", url.toString())
          } catch {}
        } else {
          setError("No escrows found for your account.")
        }
      } catch (e: any) {
        setError(e?.message || "Failed to initialize")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [apiBase])

  const selectEscrow = async (id: string) => {
    try {
      setActiveId(id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
      const res = await fetch(`${apiBase}/api/escrows/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, "ngrok-skip-browser-warning": "1" },
      })
      if (!res.ok) return
      const data = await res.json()
      setEscrow(data)
      setBuyerProfile((data as any).buyer_profile || null)
      setSellerProfile((data as any).seller_profile || null)
      await fetchMessages(id)
    } catch (e) {
      // noop
    }
  }

  const fetchConversations = async () => {
    try {
      setConvListLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // also get current user id to determine the other participant
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const meId = currentUser?.id
      const res = await fetch(`${apiBase}/api/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}`, "ngrok-skip-browser-warning": "1" },
      })
      if (!res.ok) return
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []

      // Enrich items with listing title and other participant username when possible
      const enhanced = await Promise.all(items.map(async (it: any) => {
        const copy = { ...it }
        try {
          // If there's a listing_id but no listing object, try fetching the listing to get its title
          if (copy.listing_id && !copy.listing && !copy.listing_title) {
            try {
              const lr = await fetch(`${apiBase}/api/listings/${copy.listing_id}`, {
                headers: { Authorization: `Bearer ${session.access_token}`, "ngrok-skip-browser-warning": "1" },
              })
              if (lr.ok) {
                const listingData = await lr.json().catch(() => null)
                if (listingData) copy.listing = listingData
              }
            } catch (e) {}
          }

          // Determine other participant id and try to resolve username via profiles table
          if (meId) {
            const otherId = copy.starter_id === meId ? (copy.recipient_id || copy.recipient) : (copy.starter_id || copy.starter)
            if (otherId) {
              try {
                const { data: profiles, error } = await supabase.from('profiles').select('id,username').eq('id', otherId).limit(1)
                if (!error && profiles && profiles.length > 0) {
                  copy.other_username = profiles[0].username
                }
              } catch (e) {}
            }
          }
        } catch (e) {
          // ignore per-item failures
        }
        return copy
      }))

      setConversations(enhanced)
    } finally {
      setConvListLoading(false)
    }
  }

  // Helpers to derive display names/titles for conversations
  const deriveConversationTitle = (conv: any) => {
  // Prefer listing title (if this convo was started from a listing), then explicit title, then generic label
  if (!conv) return 'Conversation'
  if (conv.listing && conv.listing.title) return conv.listing.title
  if (conv.listing_title) return conv.listing_title
  if (conv.title && String(conv.title).trim()) return conv.title
  return 'Conversation'
  }

  const deriveOtherPartyName = (conv: any) => {
  if (!conv || !user) return 'Them'
  if (convOtherName) return convOtherName
    // conv may include starter_profile and recipient_profile from API
    const meId = user.id
    const other = conv.starter_id === meId ? (conv.recipient_profile || conv.recipient) : (conv.starter_profile || conv.starter)
    if (other) {
      if (typeof other === 'string') return other
      if (other.username) return other.username
      if (other.display_name) return other.display_name
    }
    // Last-resort: show the opposite id shortened
    const otherId = conv.starter_id === meId ? conv.recipient_id || conv.recipient : conv.starter_id || conv.starter
    if (otherId) return `User ${String(otherId).slice(0, 8)}`
    return 'Them'
  }

  const selectConversation = async (id: string) => {
    try {
      setActiveConvId(id)
      setConvLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${apiBase}/api/messages/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, "ngrok-skip-browser-warning": "1" },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Failed to load conversation')
        return
      }
      const data = await res.json()
      const conv = data.conversation || null
      setConversation(conv)
      setConvOtherName(null)
      // Try to fetch the other participant's profile if not already present
      try {
        if (conv && user?.id) {
          const meId = user.id
          const otherId = conv.starter_id === meId ? conv.recipient_id || conv.recipient : conv.starter_id || conv.starter
          if (otherId) {
            const { data: profiles, error } = await supabase.from('profiles').select('id,username').eq('id', otherId).limit(1)
            if (!error && profiles && profiles.length > 0) {
              setConvOtherName(profiles[0].username)
            }
          }
        }
      } catch (e) {
        // ignore
      }
      setConvMessages(data.messages || [])
      try {
        const url = new URL(window.location.href)
        url.searchParams.set("c", id)
        url.searchParams.delete("escrow")
        url.searchParams.delete("e")
        url.searchParams.delete("id")
        window.history.replaceState({}, "", url.toString())
      } catch {}
    } finally {
      setConvLoading(false)
    }
  }

  const fetchMessages = async (id: string) => {
    try {
      setChatLoading(true)
      const { data, error } = await supabase
        .from("escrow_messages")
        .select("*")
        .eq("escrow_id", id)
        .order("created_at", { ascending: true })
      if (!error) setChatMessages(data || [])
    } finally {
      setChatLoading(false)
      if (chatRef.current) {
        setTimeout(() => {
          if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
        }, 0)
      }
    }
  }

  // Realtime updates for selected escrow
  useEffect(() => {
    if (!activeId || !user?.id) return
    const channel = supabase
      .channel(`escrow-messages-${activeId}`, {
        config: { broadcast: { self: false }, presence: { key: user.id } }
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "escrow_messages", filter: `escrow_id=eq.${activeId}` },
        (payload) => {
          setChatMessages((prev) => {
            const exists = prev.some((m: any) => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "escrow_messages", filter: `escrow_id=eq.${activeId}` },
        (payload) => {
          setChatMessages((prev) => prev.map((m: any) => (m.id === payload.new.id ? payload.new : m)))
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [activeId, user?.id])

  // Realtime updates for selected conversation
  useEffect(() => {
    if (!activeConvId || !user?.id) return
    const channel = supabase
      .channel(`conversation-messages-${activeConvId}`, {
        config: { broadcast: { self: false }, presence: { key: user.id } }
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          setConvMessages((prev) => {
            const exists = prev.some((m: any) => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [activeConvId, user?.id])

  // Load conversation list whenever user/apiBase available
  useEffect(() => {
    if (!apiBase) return
    fetchConversations()
  }, [apiBase])

  const sendChatMessage = async () => {
    if (!activeId || !user?.id || !chatText.trim()) return
    const text = chatText.trim()
    setChatText("")

    const tempNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic = {
      id: `temp-${tempNonce}`,
      client_nonce: tempNonce,
      escrow_id: activeId,
      sender_id: user.id,
      message: text,
      message_type: "text",
      created_at: new Date().toISOString(),
    }
    setChatMessages((prev) => [...prev, optimistic])

    try {
      const { data, error } = await supabase.from("escrow_messages").insert({
        escrow_id: activeId,
        sender_id: user.id,
        message: text,
        message_type: "text",
        metadata: { client_nonce: tempNonce },
      })
      if (error) {
        setChatMessages((prev) => prev.filter((m: any) => m.client_nonce !== tempNonce))
        setChatText(text)
      }
    } catch (e) {
      setChatMessages((prev) => prev.filter((m: any) => m.client_nonce !== tempNonce))
      setChatText(text)
    }
  }

  const sendConvMessage = async () => {
    if (!activeConvId || !user?.id || !chatText.trim()) return
    const text = chatText.trim()
    setChatText("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${apiBase}/api/messages/${activeConvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ body: text })
      })
      if (!res.ok) {
        setChatText(text)
        return
      }
      const m = await res.json()
      setConvMessages((prev) => [...prev, m])
    } catch (e) {
      setChatText(text)
    }
  }

  // Auto-scroll to the newest message whenever the list grows
  useEffect(() => {
    if (!chatRef.current) return
    try {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
    } catch {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages.length, convMessages.length])

  // Scroll-based reveal animations
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-anim]')) as HTMLElement[]
    if (!elements.length) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          ;(entry.target as HTMLElement).setAttribute('data-anim-visible', '')
        }
      })
    }, { threshold: 0.08 })
    elements.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [escrows, activeId, chatMessages.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading messages...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* Conversations list - pitch black */}
          <section className="col-span-12 md:col-span-4 rounded-2xl border border-white/10 bg-black overflow-hidden">
            <div className="p-4 border-b border-white/10 font-semibold">Chats</div>
            <div className="p-3">
              <input
                placeholder="Search"
                className="w-full px-3 py-2 rounded-xl bg-black border border-white/15 text-sm transition-colors duration-200 focus:border-white/25 outline-none"
              />
            </div>
            <div className="max-h-[65vh] overflow-auto divide-y divide-white/10">
              {/* Conversation list first */}
              {conversations.length > 0 && (
                conversations.map((c, i) => {
                  const isActive = activeConvId === c.id
                  const preview = c.last_message?.body || (deriveConversationTitle(c) || 'Conversation')
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectConversation(c.id)}
                      className={`group tilt w-full text-left p-3 hover:bg-white/10 ${isActive ? 'bg-white/10' : ''} transform-gpu transition-all duration-200 ease-out`}
                      style={{ animationDelay: `${i * 40}ms` }}
                      data-anim
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate">
                          {c.listing?.title || c.listing_title || c.other_username || deriveConversationTitle(c)}
                        </div>
                        <div className="text-xs text-gray-400 ml-2 shrink-0">
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{preview}</div>
                    </button>
                  )
                })
              )}

              {/* Escrow list fallback */}
              {conversations.length === 0 && (
                listLoading ? (
                  <div className="p-3 text-gray-400">Loading…</div>
                ) : escrows.length === 0 ? (
                  <div className="p-3 text-gray-400">No escrows</div>
                ) : (
                  escrows.map((e, i) => {
                    const isActive = activeId === e.id
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          selectEscrow(e.id)
                          try {
                            const url = new URL(window.location.href)
                            url.searchParams.set("escrow", e.id)
                            window.history.replaceState({}, "", url.toString())
                          } catch {}
                        }}
                        className={`group tilt w-full text-left p-3 hover:bg-white/10 ${isActive ? 'bg-white/10' : ''} transform-gpu transition-all duration-200 ease-out`}
                        style={{ animationDelay: `${i * 40}ms` }}
                        data-anim
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium truncate">
                            {e.title?.trim() || `Escrow #${e.id.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-gray-400 ml-2 shrink-0">
                            {e.amount} {e.currency}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 capitalize">{e.status}</div>
                      </button>
                    )
                  })
                )
              )}
            </div>
          </section>

          {/* Chat pane */}
          <section className="col-span-12 md:col-span-8 rounded-2xl border border-white/10 bg-black/60 overflow-hidden messages-page-wrapper">
            <div className="p-4 border-b border-white/10 font-semibold">
              {activeConvId ? (deriveConversationTitle(conversation) || 'Conversation') : (escrow?.title || 'Conversation')}
            </div>
            <div className="p-4 space-y-4">
              {user && (escrow || activeConvId) ? (
                <>
                  <div
                    ref={chatRef}
                    role="log"
                    aria-live="polite"
                    className="chat-scroll h-[56vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-gray-950/50 to-black/50 border border-white/10 p-4 space-y-3 scroll-smooth"
                  >
                    {(activeConvId ? convLoading : chatLoading) ? (
                      <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>
                    ) : ((activeConvId ? convMessages.length === 0 : chatMessages.length === 0) ? (
                      <div className="h-full flex items-center justify-center text-gray-400">No messages yet</div>
                    ) : activeConvId ? (
                      convMessages.map((m: any, i: number) => {
                        const isMe = m.sender_id === user.id
                          const senderName = isMe ? "You" : deriveOtherPartyName(conversation)
                        const timeText = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        return (
                          <div
                            key={m.id}
                            className={`chat ${isMe ? "chat-end" : "chat-start"} animate-fade-slide-up`}
                            style={{ animationDelay: `${i * 20}ms` }}
                          >
                              <div className="chat-header">
                                {isMe ? 'You' : (m.sender_profile?.username || senderName)}
                                <time className="text-xs opacity-50 ml-1">{timeText}</time>
                              </div>
                            <div className={`chat-bubble ${isMe ? "bg-orange-600 text-white" : ""} rounded-2xl whitespace-pre-wrap break-words max-w-[70%]`}>{m.body}</div>
                          </div>
                        )
                      })
                    ) : (
                      chatMessages.map((m: any, i: number) => {
                        const isMe = m.sender_id === user.id
                        const isSystem = m.message_type === "system"
                        const isFresh = !!m.client_nonce || (Date.now() - new Date(m.created_at).getTime() < 2000)
                        if (isSystem) {
                          return (
                            <div key={m.id} className="flex justify-center animate-fade-slide-up my-2" style={{ animationDelay: `${i * 20}ms` }}>
                              <div className="max-w-lg w-full text-xs text-gray-300 bg-black/50 border border-white/10 rounded-full px-4 py-2 shadow-sm shadow-black/30">
                                <div className="text-center">{m.message}</div>
                              </div>
                            </div>
                          )
                        }
                        const isBuyerSender = escrow ? m.sender_id === escrow.buyer_id : false
                        const senderName = isMe
                          ? "You"
                          : isBuyerSender
                            ? (buyerProfile?.username || "Buyer")
                            : (sellerProfile?.username || "Seller")
                        const timeText = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        return (
                          <div
                            key={m.id || m.client_nonce}
                            className={`chat ${isMe ? "chat-end" : "chat-start"} animate-fade-slide-up`}
                            style={{ animationDelay: `${i * 20}ms` }}
                          >
                            <div className="chat-header">
                              {senderName}
                              <time className="text-xs opacity-50 ml-1">{timeText}</time>
                            </div>
                            <div className={`chat-bubble ${isMe ? "bg-orange-600 text-white" : ""} rounded-2xl whitespace-pre-wrap break-words max-w-[70%]`}>{m.message}</div>
                            {isFresh ? (
                              <div className="chat-footer opacity-50">Sending…</div>
                            ) : null}
                          </div>
                        )
                      })
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 rounded-full bg-black/60 border border-white/15 text-white placeholder-gray-400 transition-all duration-200 focus:border-white/25 focus:bg-black/80 outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); activeConvId ? sendConvMessage() : sendChatMessage() } }}
                    />
                    <button
                      onClick={activeConvId ? sendConvMessage : sendChatMessage}
                      disabled={!chatText.trim()}
                      className="px-6 py-3 rounded-full bg-orange-600 hover:bg-orange-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transform-gpu transition-all duration-200 ease-out hover:scale-105 active:scale-95 shadow-lg shadow-orange-600/20"
                    >
                      Send
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400">Select a chat to start messaging</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        /* Remove any selection highlight artifacts in chat bubbles */
        .chat-bubble::selection { background: rgba(0,0,0,0.15); color: inherit; }
        .chat-bubble *::selection { background: rgba(0,0,0,0.15); color: inherit; }

        /* Scope chat height to messages page */
        .messages-page-wrapper [role="log"] {
          height: 56vh;
          max-height: 56vh;
        }
        @media (min-width: 768px) {
          .messages-page-wrapper [role="log"] {
            height: 64vh;
            max-height: 64vh;
          }
        }

        /* Smooth scroll behavior and inertial momentum (where supported) */
        .chat-scroll { 
          scroll-behavior: smooth; 
          -webkit-overflow-scrolling: touch;
        }
        
        /* Hide scrollbar for cleaner look */
        .chat-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Simple fade + slide up animation */
        [data-anim], .animate-fade-slide-up {
          opacity: 0;
          transform: translateY(12px);
          animation: fadeSlideUp 400ms ease-out forwards;
        }
        [data-anim][data-anim-visible] { 
          opacity: 1; 
          transform: translateY(0); 
        }
        @keyframes fadeSlideUp {
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        /* Gentle tilt effect */
        .tilt { 
          transform-style: preserve-3d; 
          transition: transform 180ms ease; 
        }
        .tilt:hover { 
          transform: perspective(800px) rotateX(1.2deg) rotateY(-1.2deg) translateZ(0); 
        }
        .tilt:active { 
          transform: perspective(800px) scale(0.98); 
        }

        /* Using DaisyUI chat bubbles now; custom bubble styles removed */
      `}</style>
    </div>
  )
}
