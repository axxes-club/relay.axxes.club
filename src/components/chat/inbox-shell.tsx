"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, BellOff, Check, Download, MoreHorizontal, Pin, PinOff, Search, SquarePen, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InboxConversation, Person } from "@/lib/chat/types"
import { listTime } from "@/lib/chat/time"
import { previewText } from "@/lib/chat/format"
import { EVENTS, userChannel } from "@/lib/chat/events"
import { markAsRead, setMuted, setPinned } from "@/lib/actions/messaging"
import { Avatar, GroupAvatar } from "./avatar"
import { MenuItem, Popover } from "./popover"
import { useChannel } from "./use-realtime"
import { QuickSwitcher } from "./quick-switcher"
import { useInstall } from "./pwa"

type Filter = "all" | "unread" | "direct" | "group"

type InboxApi = {
  me: Person
  conversations: InboxConversation[]
  /** The open thread reports activity so the list updates without a refetch. */
  bump: (id: string, preview: string, at: Date | string) => void
  clearUnread: (id: string) => void
  update: (id: string, patch: Partial<InboxConversation>) => void
}
const InboxContext = React.createContext<InboxApi | null>(null)
export const useInbox = () => React.useContext(InboxContext)

function sortConversations(list: InboxConversation[]) {
  return [...list].sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
  })
}

export function InboxShell({ me, initial, children }: { me: Person; initial: InboxConversation[]; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const activeId = pathname.match(/^\/inbox\/([0-9a-f-]{36})/)?.[1] ?? null
  const inPane = pathname !== "/inbox"
  const [conversations, setConversations] = React.useState(() => sortConversations(initial))
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [switcher, setSwitcher] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Server data replaces local state whenever the layout re-renders (router.refresh).
  React.useEffect(() => setConversations(sortConversations(initial)), [initial])

  // Tell the CSS which pane a phone should show.
  React.useEffect(() => {
    document.documentElement.dataset.chat = inPane ? "thread" : "list"
    return () => { delete document.documentElement.dataset.chat }
  }, [inPane])

  const refreshSoon = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => router.refresh(), 600)
  }, [router])

  const api = React.useMemo<InboxApi>(() => ({
    me,
    conversations,
    bump: (id, preview, at) =>
      setConversations((list) => sortConversations(list.map((c) => (c.id === id ? { ...c, lastMessagePreview: preview, lastMessageAt: at } : c)))),
    clearUnread: (id) => setConversations((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))),
    update: (id, patch) => setConversations((list) => sortConversations(list.map((c) => (c.id === id ? { ...c, ...patch } : c)))),
  }), [me, conversations])

  // A message somewhere else: count it, show it, and pick up the new preview.
  useChannel(userChannel(me.id), {
    [EVENTS.UNREAD_COUNT_UPDATED]: (data: { conversationId: string; unreadCount: number; preview?: string; senderName?: string; sentAt?: string }) => {
      const convo = conversations.find((c) => c.id === data.conversationId)
      const viewing = data.conversationId === activeId && document.visibilityState === "visible"
      setConversations((list) =>
        sortConversations(list.map((c) => c.id === data.conversationId
          ? { ...c, unreadCount: viewing ? 0 : data.unreadCount, lastMessagePreview: data.preview ?? c.lastMessagePreview, lastMessageAt: data.sentAt ?? new Date().toISOString() }
          : c)),
      )
      if (!convo) refreshSoon()
      if (!viewing && !convo?.isMuted) notify(convo?.title ?? data.senderName ?? "Relay", `${convo?.type === "group" && data.senderName ? `${data.senderName}: ` : ""}${previewText(data.preview ?? "New message", 140)}`, `/inbox/${data.conversationId}`)
    },
  })

  // Unread total → tab title and the installed app's icon badge.
  const totalUnread = conversations.reduce((n, c) => n + (c.isMuted ? 0 : c.unreadCount), 0)
  React.useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Relay` : "Relay"
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (totalUnread) nav.setAppBadge?.(totalUnread).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [totalUnread])

  // Keyboard: ⌘K switch, Alt+↑/↓ move between conversations, "/" search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSwitcher((s) => !s); return }
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault()
        const list = visible
        const i = list.findIndex((c) => c.id === activeId)
        const next = list[e.key === "ArrowDown" ? Math.min(i + 1, list.length - 1) : Math.max(i - 1, 0)]
        if (next) router.push(`/inbox/${next.id}`)
        return
      }
      if (!typing && e.key === "/") { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const q = query.trim().toLowerCase()
  const visible = conversations.filter((c) => {
    if (filter === "unread" && !c.unreadCount) return false
    if (filter === "direct" && c.type !== "direct") return false
    if (filter === "group" && c.type !== "group") return false
    if (!q) return true
    return c.title.toLowerCase().includes(q) || (c.lastMessagePreview ?? "").toLowerCase().includes(q) || c.participants.some((p) => p.name.toLowerCase().includes(q))
  })
  const pinned = visible.filter((c) => c.isPinned)
  const rest = visible.filter((c) => !c.isPinned)
  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length

  return (
    <InboxContext.Provider value={api}>
      <div className="relay-chat flex h-full min-h-0 overflow-hidden">
        {/* ── Conversation list ── */}
        <section
          aria-label="Conversations"
          className={cn("relay-list min-h-0 w-full flex-col border-line bg-panel/60 lg:flex lg:w-[340px] lg:border-r xl:w-[380px]", inPane ? "hidden" : "flex")}
        >
          <ListHeader onCompose={() => router.push("/inbox/new")} />
          <div className="px-3 pb-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); e.currentTarget.blur() } if (e.key === "Enter" && visible[0]) router.push(`/inbox/${visible[0].id}`) }}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="h-10 w-full rounded-xl border border-transparent bg-panel-2 pl-9 pr-14 text-sm text-text outline-none transition placeholder:text-muted/70 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-text"><X className="size-4" /></button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[10px] text-muted sm:block">/</kbd>
              )}
            </label>
            <div role="tablist" aria-label="Filter conversations" className="mt-2 flex gap-1">
              {([["all", "All"], ["unread", unreadTotal ? `Unread · ${unreadTotal}` : "Unread"], ["direct", "Direct"], ["group", "Groups"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition", filter === key ? "bg-accent text-accent-ink" : "text-muted hover:bg-panel-2 hover:text-text")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" aria-label="Conversation list">
            {visible.length === 0 ? (
              <EmptyList filtered={!!q || filter !== "all"} />
            ) : (
              <>
                {pinned.length > 0 && <SectionLabel>Pinned</SectionLabel>}
                {pinned.map((c) => <ConversationRow key={c.id} c={c} active={c.id === activeId} />)}
                {pinned.length > 0 && rest.length > 0 && <SectionLabel>All messages</SectionLabel>}
                {rest.map((c) => <ConversationRow key={c.id} c={c} active={c.id === activeId} />)}
              </>
            )}
          </nav>
          <ListFooter />
        </section>

        {/* ── Thread ── */}
        <section aria-label="Conversation" className={cn("relay-thread min-h-0 min-w-0 flex-1 flex-col lg:flex", inPane ? "flex" : "hidden")}>
          {children}
        </section>
      </div>
      <QuickSwitcher open={switcher} onClose={() => setSwitcher(false)} conversations={conversations} />
    </InboxContext.Provider>
  )
}

function ListHeader({ onCompose }: { onCompose: () => void }) {
  return (
    <header className="relay-titlebar flex items-center justify-between gap-2 px-4 pb-3 pt-4">
      <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
      <div className="flex items-center gap-1">
        <InstallButton />
        <button type="button" onClick={onCompose} title="New message (N)" aria-label="New message" className="grid size-9 place-items-center rounded-xl text-text transition hover:bg-panel-2">
          <SquarePen className="size-[18px]" />
        </button>
      </div>
    </header>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted">{children}</p>
}

function EmptyList({ filtered }: { filtered: boolean }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <p className="text-sm font-medium">{filtered ? "Nothing matches" : "No conversations yet"}</p>
      <p className="mt-1 text-sm text-muted">{filtered ? "Try another name or clear the filter." : "Start one with anyone in your workspace."}</p>
      {!filtered && <Link href="/inbox/new" className="btn-primary mt-4">New message</Link>}
    </div>
  )
}

function ConversationRow({ c, active }: { c: InboxConversation; active: boolean }) {
  const inbox = useInbox()!
  const [menu, setMenu] = React.useState(false)
  const btn = React.useRef<HTMLButtonElement>(null)
  const unread = c.unreadCount > 0
  const toggle = async (patch: Partial<InboxConversation>, run: () => Promise<unknown>) => {
    setMenu(false)
    const before = { isPinned: c.isPinned, isMuted: c.isMuted, unreadCount: c.unreadCount }
    inbox.update(c.id, patch)
    try { await run() } catch { inbox.update(c.id, before) }
  }
  return (
    <div className={cn("group relative mb-0.5 flex items-center rounded-xl transition", active ? "bg-accent/12 ring-1 ring-inset ring-accent/25" : "hover:bg-panel-2")}>
      <Link
        href={`/inbox/${c.id}`}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {c.type === "group" ? <GroupAvatar people={c.others} seed={c.id} /> : <Avatar name={c.title} image={c.others[0]?.image} seed={c.others[0]?.userId ?? c.id} />}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-[15px]", unread ? "font-semibold text-text" : "font-medium text-text/90")}>{c.title}</span>
            <span className={cn("shrink-0 text-[11px] tabular-nums", unread ? "text-accent" : "text-muted")}><LocalTime value={c.lastMessageAt} /></span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "text-text/85" : "text-muted")}>
              {c.lastMessagePreview ? previewText(c.lastMessagePreview, 90) : <em className="not-italic text-muted/70">No messages yet</em>}
            </span>
            {c.isMuted && <BellOff aria-label="Muted" className="size-3.5 shrink-0 text-muted" />}
            {c.isPinned && !unread && <Pin aria-label="Pinned" className="size-3.5 shrink-0 rotate-45 text-muted" />}
            {unread && (
              <span className={cn("grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums", c.isMuted ? "bg-panel-2 text-muted" : "bg-accent text-accent-ink")}>
                {c.unreadCount > 99 ? "99+" : c.unreadCount}
              </span>
            )}
          </span>
        </span>
      </Link>
      <button
        ref={btn}
        type="button"
        aria-label={`Options for ${c.title}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-panel text-muted opacity-0 shadow transition hover:text-text focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 max-lg:hidden"
      >
        <MoreHorizontal className="size-4" />
      </button>
      <Popover anchor={btn.current} open={menu} onClose={() => setMenu(false)} label={`Options for ${c.title}`}>
        <MenuItem icon={c.isPinned ? <PinOff /> : <Pin />} onSelect={() => toggle({ isPinned: !c.isPinned }, () => setPinned(c.id, !c.isPinned))}>{c.isPinned ? "Unpin" : "Pin to top"}</MenuItem>
        <MenuItem icon={c.isMuted ? <Bell /> : <BellOff />} onSelect={() => toggle({ isMuted: !c.isMuted }, () => setMuted(c.id, !c.isMuted))}>{c.isMuted ? "Unmute" : "Mute"}</MenuItem>
        {unread && <MenuItem icon={<Check />} onSelect={() => toggle({ unreadCount: 0 }, () => markAsRead(c.id))}>Mark as read</MenuItem>}
      </Popover>
    </div>
  )
}

function InstallButton() {
  const install = useInstall()
  if (!install.available) return null
  return (
    <button type="button" onClick={install.prompt} className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted transition hover:bg-panel-2 hover:text-text" title="Install Relay as an app">
      <Download className="size-4" /> Install
    </button>
  )
}

function ListFooter() {
  const [perm, setPerm] = React.useState<NotificationPermission | "unsupported">("default")
  React.useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), [])
  if (perm !== "default") return null
  return (
    <div className="border-t border-line p-3">
      <button
        type="button"
        onClick={async () => setPerm(await Notification.requestPermission())}
        className="flex w-full items-center gap-3 rounded-xl bg-panel-2 px-3 py-2.5 text-left text-sm transition hover:bg-panel-2/70"
      >
        <Bell className="size-4 text-accent" />
        <span className="flex-1"><span className="block font-medium">Turn on notifications</span><span className="block text-xs text-muted">Get a heads-up when Relay is in the background.</span></span>
      </button>
    </div>
  )
}

/**
 * Times in the viewer's own time zone. The server renders in UTC, so the time is
 * filled in after hydration rather than rendered on the server and mismatched.
 */
function LocalTime({ value }: { value: string | Date | null }) {
  const [text, setText] = React.useState("")
  React.useEffect(() => {
    setText(listTime(value))
    const t = setInterval(() => setText(listTime(value)), 60_000)
    return () => clearInterval(t)
  }, [value])
  return <>{text}</>
}

/** A desktop/OS notification, only when the page isn't in front of the person. */
function notify(title: string, body: string, url: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return
  if (document.visibilityState === "visible" && document.hasFocus()) return
  const show = async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return reg.showNotification(title, { body, tag: url, data: { url }, icon: "/icons/192", badge: "/icons/96" })
    const n = new Notification(title, { body, tag: url, icon: "/icons/192" })
    n.onclick = () => { window.focus(); location.assign(url) }
  }
  show().catch(() => {})
}
