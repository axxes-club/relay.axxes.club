"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { createConversation } from "@/lib/actions/messaging"
import { Avatar } from "./avatar"

type Member = { id: string; name: string; email: string; image: string | null }

/** "To:" with people as chips, a filtered member list, and a group name once 2+ are chosen. */
export function NewMessage({ members }: { members: Member[] }) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [picked, setPicked] = React.useState<Member[]>([])
  const [name, setName] = React.useState("")
  const [active, setActive] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState("")
  const input = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => { input.current?.focus() }, [])

  const q = query.trim().toLowerCase()
  const options = members.filter((m) => !picked.some((p) => p.id === m.id) && (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)))
  const toggle = (m: Member) => {
    setPicked((list) => (list.some((p) => p.id === m.id) ? list.filter((p) => p.id !== m.id) : [...list, m]))
    setQuery("")
    setActive(0)
    input.current?.focus()
  }
  const group = picked.length > 1

  const start = async () => {
    if (!picked.length || pending) return
    setPending(true)
    setError("")
    try {
      const convo = await createConversation({ participantIds: picked.map((p) => p.id), name: group ? name.trim() || undefined : undefined, type: group ? "group" : "direct" })
      router.push(`/inbox/${convo.id}`)
      router.refresh()
    } catch {
      setError("Couldn't start the conversation. Please try again.")
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="relay-titlebar flex items-center gap-3 border-b border-line bg-bg/85 px-2 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
        <Link href="/inbox" aria-label="Back to conversations" className="grid size-9 place-items-center rounded-xl hover:bg-panel-2 lg:hidden"><ArrowLeft className="size-5" /></Link>
        <h1 className="flex-1 text-lg font-semibold tracking-tight">New message</h1>
        <button type="button" onClick={start} disabled={!picked.length || pending} className="btn-primary h-9 px-4">
          {pending ? <Loader2 className="size-4 animate-spin" /> : group ? "Create group" : "Start chat"}
        </button>
      </header>

      <div className="border-b border-line px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5" onClick={() => input.current?.focus()}>
          <span className="mr-1 text-sm text-muted">To:</span>
          {picked.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-accent/15 py-0.5 pl-0.5 pr-1.5 text-sm text-text">
              <Avatar name={p.name} image={p.image} seed={p.id} size="xs" />
              {p.name.split(" ")[0]}
              <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.name}`} className="grid size-4 place-items-center rounded-full text-muted hover:text-text"><X className="size-3" /></button>
            </span>
          ))}
          <input
            ref={input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
              if (e.key === "Enter") { e.preventDefault(); if (options[active] && q) toggle(options[active]); else if (picked.length) start(); else if (options[active]) toggle(options[active]) }
              if (e.key === "Backspace" && !query && picked.length) setPicked((list) => list.slice(0, -1))
            }}
            placeholder={picked.length ? "Add more people" : "Type a name"}
            aria-label="Add people"
            role="combobox"
            aria-expanded="true"
            aria-controls="new-message-people"
            className="min-w-40 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted/70"
          />
        </div>
        {group && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Group name (optional)"
            aria-label="Group name"
            className="input mt-3"
          />
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <ul id="new-message-people" role="listbox" aria-label="People in your workspace" className="min-h-0 flex-1 overflow-y-auto p-2 sm:px-4">
        {members.length === 0 && <li className="p-6 text-center text-sm text-muted">Nobody else is in this workspace yet.</li>}
        {members.length > 0 && options.length === 0 && <li className="p-6 text-center text-sm text-muted">{q ? `No one matches “${query}”.` : "Everyone's added."}</li>}
        {options.map((m, i) => (
          <li
            key={m.id}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => toggle(m)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", i === active && "bg-panel-2")}
          >
            <Avatar name={m.name} image={m.image} seed={m.id} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{m.name}</span>
              <span className="block truncate text-xs text-muted">{m.email}</span>
            </span>
            <span className="grid size-5 place-items-center rounded-full border border-line text-transparent"><Check className="size-3" /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
