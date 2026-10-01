"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDown, ArrowLeft, Bell, BellOff, Info, Loader2, Pin, PinOff, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage, ThreadConversation } from "@/lib/chat/types"
import { dayKey, dayLabel } from "@/lib/chat/time"
import { previewText } from "@/lib/chat/format"
import { EVENTS, conversationChannel } from "@/lib/chat/events"
import { deleteMessage, editMessage, markAsRead, sendMessage, setMuted, setPinned, toggleReaction } from "@/lib/actions/messaging"
import { Avatar, GroupAvatar } from "./avatar"
import { Composer, type ComposerHandle } from "./composer"
import { MessageRow, type MessageActions } from "./message"
import { REALTIME, useChannel } from "./use-realtime"
import { useInbox } from "./inbox-shell"

const GROUP_GAP = 5 * 60 * 1000
const PAGE = 50

type Page = { data: ChatMessage[]; nextCursor: string | null }

async function fetchPage(id: string, cursor?: string | null, limit = PAGE): Promise<Page> {
  const res = await fetch(`/api/v1/conversations/${id}/messages?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Could not load messages")
  const json = await res.json()
  return { data: Array.isArray(json.data) ? json.data : [], nextCursor: json.nextCursor ?? null }
}

function mergeById(list: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map(list.map((m) => [m.id, m]))
  for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m, pending: false, failed: false })
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function Thread({ conversation }: { conversation: ThreadConversation }) {
  const inbox = useInbox()
  const meId = conversation.selfId
  const self = conversation.participants.find((p) => p.userId === meId)
  const others = conversation.participants.filter((p) => p.userId !== meId)
  const title = conversation.type === "group" ? conversation.name || others.map((p) => p.name.split(" ")[0]).join(", ") || "Group" : others[0]?.name || "Just you"
  const names = React.useMemo(() => new Map(conversation.participants.map((p) => [p.userId, p.name])), [conversation.participants])
  const images = React.useMemo(() => new Map(conversation.participants.map((p) => [p.userId, p.image])), [conversation.participants])

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const [error, setError] = React.useState("")
  const [typing, setTyping] = React.useState<Map<string, string>>(new Map())
  const [readAt, setReadAt] = React.useState(() => new Map(conversation.participants.map((p) => [p.userId, p.lastReadAt ? new Date(p.lastReadAt).getTime() : 0])))
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null)
  const [editing, setEditing] = React.useState<ChatMessage | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<ChatMessage | null>(null)
  const [atBottom, setAtBottom] = React.useState(true)
  const [newBelow, setNewBelow] = React.useState(0)
  const [highlight, setHighlight] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState(false)
  const [flags, setFlags] = React.useState({ isPinned: !!conversation.isPinned, isMuted: !!conversation.isMuted })

  const listRef = React.useRef<HTMLDivElement>(null)
  const composer = React.useRef<ComposerHandle>(null)
  const unreadSince = React.useRef(self?.lastReadAt ? new Date(self.lastReadAt).getTime() : 0)
  const firstScroll = React.useRef(true)
  const typingSent = React.useRef(0)
  const typingStop = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const nearBottom = () => {
    const el = listRef.current
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140
  }
  const scrollToBottom = (smooth = true) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
    setNewBelow(0)
  }

  // The inbox context changes whenever the list does; read it through a ref so
  // marking as read never re-runs the effects that load the thread.
  const inboxRef = React.useRef(inbox)
  React.useEffect(() => { inboxRef.current = inbox })
  const read = React.useCallback(() => {
    if (document.visibilityState !== "visible") return
    inboxRef.current?.clearUnread(conversation.id)
    markAsRead(conversation.id).catch(() => {})
  }, [conversation.id])

  // First load, then read receipts.
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPage(conversation.id)
      .then((page) => { if (cancelled) return; setMessages(page.data); setCursor(page.nextCursor); setError("") })
      .catch(() => !cancelled && setError("Couldn't load this conversation. Check your connection and try again."))
      .finally(() => !cancelled && setLoading(false))
    read()
    const onVisible = () => document.visibilityState === "visible" && read()
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible) }
  }, [conversation.id, read])

  // Land on the first unread message, otherwise the bottom.
  React.useLayoutEffect(() => {
    if (loading || !firstScroll.current) return
    firstScroll.current = false
    const marker = listRef.current?.querySelector("[data-unread-divider]")
    if (marker) marker.scrollIntoView({ block: "start" })
    else scrollToBottom(false)
  }, [loading])

  // No realtime configured: poll while the tab is visible.
  React.useEffect(() => {
    if (REALTIME) return
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return
      try {
        const page = await fetchPage(conversation.id, null, 30)
        const stick = nearBottom()
        setMessages((list) => {
          const known = new Set(list.map((m) => m.id))
          const fresh = page.data.filter((m) => !known.has(m.id) && m.senderId !== meId)
          if (fresh.length) { if (!stick) setNewBelow((n) => n + fresh.length); read() }
          const ids = new Set(page.data.map((m) => m.id))
          const oldest = page.data[0] ? new Date(page.data[0].createdAt).getTime() : Infinity
          // Within the window we just fetched, anything missing was deleted.
          return mergeById(list.filter((m) => m.pending || m.failed || new Date(m.createdAt).getTime() < oldest || ids.has(m.id)), page.data)
        })
        if (stick) requestAnimationFrame(() => scrollToBottom())
      } catch {}
    }, 5000)
    return () => clearInterval(t)
  }, [conversation.id, meId, read])

  useChannel(conversationChannel(conversation.id), {
    [EVENTS.NEW_MESSAGE]: (m: ChatMessage) => {
      if (m.senderId === meId) return // our own send already reconciles
      const stick = nearBottom()
      setMessages((list) => mergeById(list, [m]))
      setTyping((t) => { const n = new Map(t); n.delete(m.senderId); return n })
      inbox?.bump(conversation.id, m.content, m.createdAt)
      if (stick) requestAnimationFrame(() => scrollToBottom()); else setNewBelow((n) => n + 1)
      read()
    },
    [EVENTS.MESSAGE_UPDATED]: (patch: Partial<ChatMessage> & { id: string }) =>
      setMessages((list) => list.map((m) => (m.id === patch.id ? { ...m, ...patch } : m))),
    [EVENTS.MESSAGE_DELETED]: ({ id }: { id: string }) => setMessages((list) => list.filter((m) => m.id !== id)),
    [EVENTS.TYPING_START]: ({ userId, userName }: { userId: string; userName: string }) => {
      if (userId === meId) return
      setTyping((t) => new Map(t).set(userId, userName))
      if (nearBottom()) requestAnimationFrame(() => scrollToBottom())
    },
    [EVENTS.TYPING_STOP]: ({ userId }: { userId: string }) => setTyping((t) => { const n = new Map(t); n.delete(userId); return n }),
    [EVENTS.MESSAGE_READ]: ({ userId, readAt: at }: { userId: string; readAt?: string }) =>
      setReadAt((r) => new Map(r).set(userId, at ? new Date(at).getTime() : Date.now())),
  })

  // Older history as you scroll up, keeping your place.
  const loadOlder = React.useCallback(async () => {
    if (!cursor || loadingOlder) return null
    setLoadingOlder(true)
    const el = listRef.current
    const before = el ? el.scrollHeight - el.scrollTop : 0
    try {
      const page = await fetchPage(conversation.id, cursor)
      setMessages((list) => mergeById(page.data, list))
      setCursor(page.nextCursor)
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before })
      return page
    } finally {
      setLoadingOlder(false)
    }
  }, [conversation.id, cursor, loadingOlder])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const bottom = nearBottom()
    setAtBottom(bottom)
    if (bottom) setNewBelow(0)
    if (el.scrollTop < 160) loadOlder()
  }

  const sendTyping = (isTyping: boolean) =>
    fetch(`/api/v1/conversations/${conversation.id}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isTyping }) }).catch(() => {})
  const onTyping = () => {
    const now = Date.now()
    if (now - typingSent.current > 2500) { typingSent.current = now; sendTyping(true) }
    if (typingStop.current) clearTimeout(typingStop.current)
    typingStop.current = setTimeout(() => { typingSent.current = 0; sendTyping(false) }, 3000)
  }

  const deliver = async (text: string, reply: ChatMessage | null, tempId: string) => {
    try {
      const sent = (await sendMessage(conversation.id, { content: text, contentType: "text", replyToId: reply?.id })) as unknown as ChatMessage
      setMessages((list) => mergeById(list.filter((m) => m.id !== tempId), [{ ...sent, replyTo: reply ? { id: reply.id, content: reply.content, senderId: reply.senderId } : null }]))
    } catch {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
    }
  }

  const send = (text: string) => {
    const tempId = `tmp-${crypto.randomUUID()}`
    const reply = replyTo
    const now = new Date().toISOString()
    setMessages((list) => [...list, { id: tempId, content: text, senderId: meId, createdAt: now, pending: true, replyToId: reply?.id ?? null, replyTo: reply ? { id: reply.id, content: reply.content, senderId: reply.senderId } : null }])
    setReplyTo(null)
    if (typingStop.current) clearTimeout(typingStop.current)
    typingSent.current = 0
    sendTyping(false)
    inbox?.bump(conversation.id, text, now)
    requestAnimationFrame(() => scrollToBottom())
    deliver(text, reply, tempId)
  }

  const actions: MessageActions = {
    reply: (m) => { setEditing(null); setReplyTo(m) },
    react: async (m, emoji) => {
      const toggle = (meta: ChatMessage["metadata"]) => {
        const reactions = { ...(meta?.reactions ?? {}) }
        const who = new Set(reactions[emoji] ?? [])
        who.has(meId) ? who.delete(meId) : who.add(meId)
        if (who.size) reactions[emoji] = [...who]; else delete reactions[emoji]
        return { ...(meta ?? {}), reactions }
      }
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, metadata: toggle(x.metadata) } : x)))
      try {
        const res = await toggleReaction(m.id, emoji)
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, metadata: res.metadata as ChatMessage["metadata"] } : x)))
      } catch {
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, metadata: m.metadata } : x)))
      }
    },
    edit: (m) => { setReplyTo(null); setEditing(m) },
    remove: (m) => setConfirmDelete(m),
    retry: (m) => {
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)))
      deliver(m.content, m.replyTo ? ({ id: m.replyTo.id, content: m.replyTo.content, senderId: m.replyTo.senderId } as ChatMessage) : null, m.id)
    },
    jumpTo: async (id) => {
      let el = document.getElementById(`m-${id}`)
      for (let i = 0; !el && i < 6; i++) {
        const page = await loadOlder()
        if (!page) break
        await new Promise((r) => requestAnimationFrame(r))
        el = document.getElementById(`m-${id}`)
      }
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlight(id)
      setTimeout(() => setHighlight(null), 1600)
    },
  }

  const saveEdit = async (text: string) => {
    const m = editing
    if (!m) return
    setEditing(null)
    if (text === m.content) return
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, content: text, isEdited: true } : x)))
    try { await editMessage(m.id, text) } catch { setMessages((list) => list.map((x) => (x.id === m.id ? m : x))) }
  }

  const doDelete = async () => {
    const m = confirmDelete
    setConfirmDelete(null)
    if (!m) return
    setMessages((list) => list.filter((x) => x.id !== m.id))
    try { await deleteMessage(m.id) } catch { setMessages((list) => mergeById(list, [m])) }
  }

  const editLast = () => {
    const last = [...messages].reverse().find((m) => m.senderId === meId && !m.pending && !m.failed)
    if (last) actions.edit(last)
  }

  // Receipt under your latest message.
  const lastOwn = [...messages].reverse().find((m) => m.senderId === meId && !m.pending && !m.failed)
  let receipt: string | null = null
  if (lastOwn) {
    const at = new Date(lastOwn.createdAt).getTime()
    const seen = others.filter((p) => (readAt.get(p.userId) ?? 0) >= at)
    if (conversation.type === "direct") receipt = seen.length ? "Seen" : "Sent"
    else receipt = seen.length === 0 ? "Sent" : seen.length === others.length ? "Seen by everyone" : `Seen by ${seen.map((p) => p.name.split(" ")[0]).join(", ")}`
  }

  const typingNames = [...typing.values()].map((n) => n.split(" ")[0])
  const subtitle = typingNames.length
    ? `${typingNames.join(", ")} ${typingNames.length > 1 ? "are" : "is"} typing…`
    : conversation.type === "group" ? `${conversation.participants.length} members` : "Direct message"

  const firstUnreadIndex = unreadSince.current
    ? messages.findIndex((m) => m.senderId !== meId && new Date(m.createdAt).getTime() > unreadSince.current)
    : -1

  const toggleFlag = async (key: "isPinned" | "isMuted") => {
    const next = !flags[key]
    setFlags((f) => ({ ...f, [key]: next }))
    inbox?.update(conversation.id, { [key]: next })
    try { await (key === "isPinned" ? setPinned(conversation.id, next) : setMuted(conversation.id, next)) }
    catch { setFlags((f) => ({ ...f, [key]: !next })); inbox?.update(conversation.id, { [key]: !next }) }
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="relay-titlebar flex items-center gap-3 border-b border-line bg-bg/85 px-2 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
          <Link href="/inbox" aria-label="Back to conversations" className="grid size-9 shrink-0 place-items-center rounded-xl text-text hover:bg-panel-2 lg:hidden">
            <ArrowLeft className="size-5" />
          </Link>
          <button type="button" onClick={() => setDetails((d) => !d)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-panel-2/60" aria-label={`Conversation details for ${title}`}>
            {conversation.type === "group" ? <GroupAvatar people={others} seed={conversation.id} /> : <Avatar name={title} image={others[0]?.image} seed={others[0]?.userId ?? conversation.id} />}
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight">{title}</span>
              <span className={cn("block truncate text-xs", typingNames.length ? "text-accent" : "text-muted")} aria-live="polite">{subtitle}</span>
            </span>
          </button>
          <button type="button" onClick={() => toggleFlag("isPinned")} aria-pressed={flags.isPinned} title={flags.isPinned ? "Unpin" : "Pin to top"} className="hidden size-9 place-items-center rounded-xl text-muted transition hover:bg-panel-2 hover:text-text sm:grid">
            {flags.isPinned ? <PinOff className="size-[18px]" /> : <Pin className="size-[18px]" />}
          </button>
          <button type="button" onClick={() => setDetails((d) => !d)} aria-pressed={details} title="Details" className={cn("grid size-9 place-items-center rounded-xl transition hover:bg-panel-2", details ? "text-accent" : "text-muted hover:text-text")}>
            <Info className="size-[18px]" />
          </button>
        </header>

        {/* Messages */}
        <div ref={listRef} onScroll={onScroll} className="relay-messages min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4" role="log" aria-live="polite" aria-relevant="additions" aria-label={`Messages with ${title}`}>
          {loading ? (
            <ThreadSkeleton />
          ) : error ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">{error}</div>
          ) : (
            <>
              {loadingOlder && <div className="flex justify-center py-3"><Loader2 className="size-4 animate-spin text-muted" /></div>}
              {!cursor && <Intro title={title} type={conversation.type} others={others} conversationId={conversation.id} />}
              {messages.map((m, i) => {
                const prev = messages[i - 1], next = messages[i + 1]
                const t = new Date(m.createdAt).getTime()
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
                const unreadHere = i === firstUnreadIndex
                const groupStart = newDay || unreadHere || !prev || prev.senderId !== m.senderId || t - new Date(prev.createdAt).getTime() > GROUP_GAP
                const groupEnd = !next || next.senderId !== m.senderId || dayKey(next.createdAt) !== dayKey(m.createdAt) || new Date(next.createdAt).getTime() - t > GROUP_GAP || messages.indexOf(next) === firstUnreadIndex
                const own = m.senderId === meId
                return (
                  <React.Fragment key={m.id}>
                    {newDay && <DayDivider label={dayLabel(m.createdAt)} />}
                    {unreadHere && <UnreadDivider />}
                    <MessageRow
                      m={m}
                      own={own}
                      groupStart={groupStart}
                      groupEnd={groupEnd}
                      showName={!own && conversation.type === "group" && groupStart}
                      senderName={own ? "You" : names.get(m.senderId) ?? m.sender?.name ?? "Someone"}
                      senderImage={images.get(m.senderId) ?? m.sender?.image ?? null}
                      meId={meId}
                      names={names}
                      receipt={m.id === lastOwn?.id ? receipt : null}
                      highlight={highlight === m.id}
                      actions={actions}
                    />
                  </React.Fragment>
                )
              })}
              {typingNames.length > 0 && <TypingBubble names={typingNames} />}
            </>
          )}
        </div>

        {!atBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-[calc(var(--composer-h,88px)+12px)] right-4 z-10 flex h-10 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-sm shadow-xl transition hover:border-accent/50 sm:right-6"
            aria-label={newBelow ? `${newBelow} new messages, jump to latest` : "Jump to latest"}
          >
            <ArrowDown className="size-4" />
            {newBelow > 0 && <span className="font-medium text-accent">{newBelow} new</span>}
          </button>
        )}

        <Composer
          ref={composer}
          draftKey={conversation.id}
          placeholder={`Message ${conversation.type === "group" ? title : title.split(" ")[0]}`}
          replyTo={replyTo}
          replyName={replyTo ? (replyTo.senderId === meId ? "yourself" : names.get(replyTo.senderId) ?? "message") : null}
          editing={editing}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSend={send}
          onSaveEdit={saveEdit}
          onTyping={onTyping}
          onEditLast={editLast}
        />
      </div>

      {details && (
        <Details
          title={title}
          conversation={conversation}
          others={others}
          flags={flags}
          onToggle={toggleFlag}
          onClose={() => setDetails(false)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in" onClick={() => setConfirmDelete(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl">
            <h2 id="del-title" className="font-semibold">Delete this message?</h2>
            <p className="mt-1 text-sm text-muted">It’s removed for everyone in the conversation.</p>
            <p className="mt-3 line-clamp-3 rounded-xl bg-panel-2 px-3 py-2 text-sm">{previewText(confirmDelete.content, 200)}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirmDelete(null)} className="btn-ghost">Cancel</button>
              <button type="button" onClick={doDelete} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="sticky top-2 z-[3] my-4 flex justify-center" role="separator">
      <span className="rounded-full border border-line bg-panel/90 px-3 py-1 text-[11px] font-medium text-muted shadow-sm backdrop-blur">{label}</span>
    </div>
  )
}

function UnreadDivider() {
  return (
    <div data-unread-divider className="my-3 flex items-center gap-3 px-5" role="separator">
      <span className="h-px flex-1 bg-accent/40" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">New messages</span>
      <span className="h-px flex-1 bg-accent/40" />
    </div>
  )
}

function TypingBubble({ names }: { names: string[] }) {
  return (
    <div className="mt-3 flex items-end gap-2 px-3 sm:px-5" aria-label={`${names.join(", ")} typing`}>
      <div className="w-8" />
      <div className="flex h-9 items-center gap-1 rounded-[20px] bg-panel-2 px-4">
        <span className="relay-dot" /><span className="relay-dot [animation-delay:150ms]" /><span className="relay-dot [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function Intro({ title, type, others, conversationId }: { title: string; type: "direct" | "group"; others: { userId: string; name: string; image: string | null }[]; conversationId: string }) {
  return (
    <div className="flex flex-col items-center px-6 pb-4 pt-10 text-center">
      {type === "group" ? <GroupAvatar people={others} seed={conversationId} size="lg" /> : <Avatar name={title} image={others[0]?.image} seed={others[0]?.userId ?? conversationId} size="lg" />}
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {type === "group" ? `This is the start of ${title}. Everyone here can see what you share.` : `This is the start of your conversation with ${title.split(" ")[0]}.`}
      </p>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4 p-5" aria-label="Loading messages">
      {[60, 40, 72, 30, 55].map((w, i) => (
        <div key={i} className={cn("flex gap-2", i % 2 ? "justify-end" : "")}>
          {i % 2 === 0 && <span className="size-8 animate-pulse rounded-full bg-panel-2" />}
          <span className="h-10 animate-pulse rounded-[20px] bg-panel-2" style={{ width: `${w}%`, maxWidth: 420 }} />
        </div>
      ))}
    </div>
  )
}

function Details({ title, conversation, others, flags, onToggle, onClose }: {
  title: string
  conversation: ThreadConversation
  others: { userId: string; name: string; image: string | null; isAdmin: boolean | null }[]
  flags: { isPinned: boolean; isMuted: boolean }
  onToggle: (key: "isPinned" | "isMuted") => void
  onClose: () => void
}) {
  return (
    <aside aria-label="Conversation details" className="fixed inset-0 z-40 flex flex-col bg-bg animate-in lg:static lg:z-auto lg:w-80 lg:shrink-0 lg:border-l lg:border-line lg:bg-panel/60">
      <header className="flex items-center justify-between border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="font-semibold">Details</h2>
        <button type="button" onClick={onClose} aria-label="Close details" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-panel-2 hover:text-text"><X className="size-5" /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center py-4 text-center">
          {conversation.type === "group" ? <GroupAvatar people={others} seed={conversation.id} size="lg" /> : <Avatar name={title} image={others[0]?.image} seed={others[0]?.userId ?? conversation.id} size="lg" />}
          <p className="mt-3 font-semibold">{title}</p>
          <p className="text-xs text-muted">{conversation.type === "group" ? `Group · ${conversation.participants.length} members` : "Direct message"}</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onToggle("isPinned")} aria-pressed={flags.isPinned} className="flex flex-col items-center gap-1.5 rounded-xl bg-panel-2 py-3 text-xs transition hover:bg-panel-2/70">
            {flags.isPinned ? <PinOff className="size-5 text-accent" /> : <Pin className="size-5" />}{flags.isPinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" onClick={() => onToggle("isMuted")} aria-pressed={flags.isMuted} className="flex flex-col items-center gap-1.5 rounded-xl bg-panel-2 py-3 text-xs transition hover:bg-panel-2/70">
            {flags.isMuted ? <Bell className="size-5 text-accent" /> : <BellOff className="size-5" />}{flags.isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
        <h3 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wider text-muted">{conversation.type === "group" ? "Members" : "Person"}</h3>
        <ul className="space-y-1">
          {conversation.participants.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar name={p.name} image={p.image} seed={p.userId} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{p.userId === conversation.selfId ? `${p.name} (you)` : p.name}</span>
              {p.isAdmin && conversation.type === "group" && <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">Admin</span>}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
