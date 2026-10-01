"use client"

import * as React from "react"
import { ArrowUp, Check, CornerUpLeft, Pencil, Smile, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/chat/types"
import { previewText } from "@/lib/chat/format"
import { Popover } from "./popover"

const EMOJI = ["😀", "😂", "🥹", "😍", "😎", "🤔", "😅", "😴", "🙌", "👏", "👍", "👎", "🙏", "💪", "👀", "🎉", "🔥", "✨", "❤️", "💜", "💯", "✅", "❌", "⚡", "🚀", "🎧", "🍾", "🕺", "💃", "📸", "📍", "🗓️", "⏰", "📦", "💸", "🧾"]

export type ComposerHandle = { focus: () => void; insert: (text: string) => void }

export const Composer = React.forwardRef<ComposerHandle, {
  draftKey: string
  placeholder: string
  replyTo: ChatMessage | null
  replyName: string | null
  editing: ChatMessage | null
  onCancelReply: () => void
  onCancelEdit: () => void
  onSend: (text: string) => void
  onSaveEdit: (text: string) => void
  onTyping: () => void
  onEditLast: () => void
}>(function Composer({ draftKey, placeholder, replyTo, replyName, editing, onCancelReply, onCancelEdit, onSend, onSaveEdit, onTyping, onEditLast }, ref) {
  const [text, setText] = React.useState("")
  const [emoji, setEmoji] = React.useState(false)
  const area = React.useRef<HTMLTextAreaElement>(null)
  const emojiBtn = React.useRef<HTMLButtonElement>(null)
  const storage = `relay:draft:${draftKey}`

  // Drafts survive switching conversations and reloads.
  React.useEffect(() => {
    try { setText(localStorage.getItem(storage) ?? "") } catch { setText("") }
  }, [storage])
  React.useEffect(() => {
    if (editing) return
    try { text ? localStorage.setItem(storage, text) : localStorage.removeItem(storage) } catch {}
  }, [text, storage, editing])

  // Editing loads the message into the box; leaving edit mode restores the draft.
  const draftBeforeEdit = React.useRef("")
  const wasEditing = React.useRef(false)
  React.useEffect(() => {
    if (editing) {
      if (!wasEditing.current) draftBeforeEdit.current = text
      wasEditing.current = true
      setText(editing.content)
      requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(editing.content.length, editing.content.length) })
    } else if (wasEditing.current) {
      wasEditing.current = false
      setText(draftBeforeEdit.current)
      draftBeforeEdit.current = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  React.useEffect(() => { if (replyTo) area.current?.focus() }, [replyTo?.id])

  // Grow with the text, up to ~40% of the screen.
  React.useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4))}px`
  }, [text])

  const insert = (value: string) => {
    const el = area.current
    if (!el) return setText((t) => t + value)
    const start = el.selectionStart ?? text.length, end = el.selectionEnd ?? text.length
    const next = text.slice(0, start) + value + text.slice(end)
    setText(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + value.length, start + value.length) })
  }
  React.useImperativeHandle(ref, () => ({ focus: () => area.current?.focus(), insert }))

  const submit = () => {
    const value = text.trim()
    if (!value) return
    if (editing) { onSaveEdit(value); return }
    onSend(value)
    setText("")
    try { localStorage.removeItem(storage) } catch {}
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const touch = window.matchMedia("(pointer: coarse)").matches
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) { e.preventDefault(); submit(); return }
    if (e.key === "Escape") { if (editing) { e.preventDefault(); onCancelEdit() } else if (replyTo) { e.preventDefault(); onCancelReply() } return }
    if (e.key === "ArrowUp" && !text && !editing) { e.preventDefault(); onEditLast() }
  }

  const can = text.trim().length > 0

  return (
    <div className="relay-composer border-t border-line bg-bg/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:px-5">
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-xs">
          {editing ? <Pencil className="size-3.5 text-accent" /> : <CornerUpLeft className="size-3.5 text-accent" />}
          <span className="min-w-0 flex-1">
            <span className="font-medium text-text">{editing ? "Editing message" : `Replying to ${replyName ?? "message"}`}</span>
            {!editing && replyTo && <span className="block truncate text-muted">{previewText(replyTo.content, 120)}</span>}
            {editing && <span className="block text-muted">Enter to save · Esc to cancel</span>}
          </span>
          <button type="button" onClick={editing ? onCancelEdit : onCancelReply} aria-label={editing ? "Cancel edit" : "Cancel reply"} className="grid size-6 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text"><X className="size-3.5" /></button>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-[22px] border border-line bg-panel py-1.5 pl-1.5 pr-1.5 transition focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10">
        <button ref={emojiBtn} type="button" onClick={() => setEmoji((v) => !v)} aria-label="Insert emoji" aria-expanded={emoji} className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-text">
          <Smile className="size-5" />
        </button>
        <textarea
          ref={area}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); if (!editing) onTyping() }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          enterKeyHint="send"
          className="max-h-[40vh] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-text outline-none placeholder:text-muted/70"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!can}
          aria-label={editing ? "Save edit" : "Send message"}
          className={cn("grid size-9 shrink-0 place-items-center rounded-full transition", can ? "bg-accent text-accent-ink hover:brightness-110 active:scale-95" : "bg-panel-2 text-muted")}
        >
          {editing ? <Check className="size-5" /> : <ArrowUp className="size-5" />}
        </button>
      </div>
      <p className="mt-1.5 hidden px-3 text-[11px] text-muted lg:block">
        <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift + Enter</kbd> new line · <kbd className="font-mono">↑</kbd> edit last · <kbd className="font-mono">⌘K</kbd> switch
      </p>
      <Popover anchor={emojiBtn.current} open={emoji} onClose={() => setEmoji(false)} side="top" align="start" label="Emoji" className="w-[min(20rem,calc(100vw-1rem))]">
        <div className="grid grid-cols-8 gap-0.5 p-1">
          {EMOJI.map((e) => (
            <button key={e} type="button" role="menuitem" onClick={() => { insert(e); setEmoji(false) }} className="grid aspect-square place-items-center rounded-lg text-xl outline-none transition hover:bg-panel-2 focus-visible:bg-panel-2">{e}</button>
          ))}
        </div>
      </Popover>
    </div>
  )
})
