"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InboxConversation } from "@/lib/chat/types"
import { listTime } from "@/lib/chat/time"
import { Avatar, GroupAvatar } from "./avatar"

/** ⌘K: jump to any conversation by name. Arrow keys to choose, Enter to open. */
export function QuickSwitcher({ open, onClose, conversations }: { open: boolean; onClose: () => void; conversations: InboxConversation[] }) {
  const router = useRouter()
  const [q, setQ] = React.useState("")
  const [i, setI] = React.useState(0)
  const input = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) { setQ(""); setI(0); requestAnimationFrame(() => input.current?.focus()) }
  }, [open])

  const term = q.trim().toLowerCase()
  const results = conversations
    .filter((c) => !term || c.title.toLowerCase().includes(term) || c.participants.some((p) => p.name.toLowerCase().includes(term)))
    .slice(0, 8)

  if (!open || typeof document === "undefined") return null
  const go = (id: string) => { onClose(); router.push(`/inbox/${id}`) }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm animate-in" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Jump to a conversation" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setI(0) }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose()
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, results.length - 1)) }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
              if (e.key === "Enter" && results[i]) go(results[i].id)
            }}
            placeholder="Jump to a conversation…"
            aria-label="Conversation name"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switcher-results"
            aria-activedescendant={results[i] ? `qs-${results[i].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-muted">esc</kbd>
        </label>
        <ul id="quick-switcher-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No conversations match “{q}”.</li>}
          {results.map((c, n) => (
            <li
              key={c.id}
              id={`qs-${c.id}`}
              role="option"
              aria-selected={n === i}
              onMouseEnter={() => setI(n)}
              onClick={() => go(c.id)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", n === i && "bg-panel-2")}
            >
              {c.type === "group" ? <GroupAvatar people={c.others} seed={c.id} size="sm" /> : <Avatar name={c.title} image={c.others[0]?.image} seed={c.others[0]?.userId ?? c.id} size="sm" />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
              {c.unreadCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">{c.unreadCount}</span>}
              <span className="text-[11px] text-muted">{listTime(c.lastMessageAt)}</span>
            </li>
          ))}
        </ul>
        <p className="flex gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span><kbd className="font-mono">↑↓</kbd> choose</span><span><kbd className="font-mono">↵</kbd> open</span><span><kbd className="font-mono">⌥↑↓</kbd> next/previous anywhere</span>
        </p>
      </div>
    </div>,
    document.body,
  )
}
