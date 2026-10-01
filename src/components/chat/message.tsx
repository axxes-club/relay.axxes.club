"use client"

import * as React from "react"
import { Copy, CornerUpLeft, MoreHorizontal, Pencil, RotateCw, SmilePlus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/lib/chat/types"
import { isEmojiOnly, previewText, renderMessage } from "@/lib/chat/format"
import { fullTime, messageTime } from "@/lib/chat/time"
import { REACTIONS } from "@/lib/chat/reactions"
import { Avatar } from "./avatar"
import { MenuItem, Popover, Sheet } from "./popover"

export type MessageActions = {
  reply: (m: ChatMessage) => void
  react: (m: ChatMessage, emoji: string) => void
  edit: (m: ChatMessage) => void
  remove: (m: ChatMessage) => void
  retry: (m: ChatMessage) => void
  jumpTo: (id: string) => void
}

const QUICK = ["👍", "❤️", "😂", "🎉"]

export const MessageRow = React.memo(function MessageRow({
  m,
  own,
  groupStart,
  groupEnd,
  showName,
  senderName,
  senderImage,
  meId,
  names,
  receipt,
  highlight,
  actions,
}: {
  m: ChatMessage
  own: boolean
  groupStart: boolean
  groupEnd: boolean
  showName: boolean
  senderName: string
  senderImage: string | null
  meId: string
  names: Map<string, string>
  receipt?: string | null
  highlight: boolean
  actions: MessageActions
}) {
  const [picker, setPicker] = React.useState(false)
  const [more, setMore] = React.useState(false)
  const [sheet, setSheet] = React.useState(false)
  const pickerBtn = React.useRef<HTMLButtonElement>(null)
  const moreBtn = React.useRef<HTMLButtonElement>(null)
  const press = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const emojiOnly = isEmojiOnly(m.content)
  const reactions = Object.entries(m.metadata?.reactions ?? {}).filter(([, who]) => who.length > 0)

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return
    press.current = setTimeout(() => { navigator.vibrate?.(10); setSheet(true) }, 420)
  }
  const endPress = () => { if (press.current) clearTimeout(press.current) }
  const copy = () => { navigator.clipboard?.writeText(m.content).catch(() => {}); setMore(false); setSheet(false) }

  const bubbleShape = own
    ? cn("rounded-[20px]", !groupStart && "rounded-tr-md", !groupEnd && "rounded-br-md")
    : cn("rounded-[20px]", !groupStart && "rounded-tl-md", !groupEnd && "rounded-bl-md")

  return (
    <div
      id={`m-${m.id}`}
      data-own={own || undefined}
      className={cn("group/msg relative flex gap-2 px-3 sm:px-5", own ? "flex-row-reverse" : "flex-row", groupStart ? "mt-3" : "mt-[3px]", highlight && "relay-flash")}
    >
      {!own && <div className="w-8 shrink-0 self-end">{groupEnd && <Avatar name={senderName} image={senderImage} seed={m.senderId} size="sm" />}</div>}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]", own ? "items-end" : "items-start")}>
        {showName && <span className="mb-1 px-3 text-xs font-medium text-muted">{senderName}</span>}

        {m.replyTo && (
          <button
            type="button"
            onClick={() => actions.jumpTo(m.replyTo!.id)}
            className={cn("mb-1 flex max-w-full items-start gap-2 rounded-2xl border border-line bg-panel/60 px-3 py-1.5 text-left text-xs text-muted transition hover:border-accent/40", own && "self-end")}
          >
            <CornerUpLeft className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium text-text/80">{m.replyTo.senderId === meId ? "You" : names.get(m.replyTo.senderId) ?? m.replyTo.sender?.name ?? "Someone"}</span>
              <span className="line-clamp-2">{previewText(m.replyTo.content, 140)}</span>
            </span>
          </button>
        )}

        <div
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => { if (window.matchMedia("(pointer: coarse)").matches) { e.preventDefault(); endPress(); setSheet(true) } }}
          title={fullTime(m.createdAt)}
          className={cn(
            "relative whitespace-pre-wrap break-words text-[15px] leading-relaxed [-webkit-touch-callout:none]",
            emojiOnly ? "px-1 text-4xl leading-tight" : cn("px-3.5 py-2", bubbleShape, own ? "bg-accent text-accent-ink" : "bg-panel-2 text-text"),
            m.pending && "opacity-60",
            m.failed && "ring-1 ring-danger/70",
          )}
        >
          {renderMessage(m.content)}
          {m.isEdited && <span className={cn("ml-1.5 align-baseline text-[11px]", own && !emojiOnly ? "text-accent-ink/60" : "text-muted")}>(edited)</span>}
        </div>

        {reactions.length > 0 && (
          <div className={cn("-mt-1.5 flex flex-wrap gap-1 px-2", own ? "justify-end" : "justify-start")}>
            {reactions.map(([emoji, who]) => {
              const mine = who.includes(meId)
              const label = who.map((id) => (id === meId ? "You" : names.get(id) ?? "Someone")).join(", ")
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => actions.react(m, emoji)}
                  title={`${label} reacted with ${emoji}`}
                  aria-pressed={mine}
                  aria-label={`${emoji} ${who.length}, ${label}`}
                  className={cn(
                    "relative z-[1] flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs shadow-sm transition",
                    mine ? "border-accent/60 bg-accent/15 text-text" : "border-line bg-panel text-muted hover:border-accent/40",
                  )}
                >
                  <span>{emoji}</span>
                  {who.length > 1 && <span className="tabular-nums">{who.length}</span>}
                </button>
              )
            })}
          </div>
        )}

        {(groupEnd || m.failed) && (
          <span className={cn("mt-1 flex items-center gap-1.5 px-2 text-[11px] text-muted", own && "justify-end")}>
            {m.failed ? (
              <button type="button" onClick={() => actions.retry(m)} className="flex items-center gap-1 text-danger hover:underline"><RotateCw className="size-3" /> Not sent — tap to retry</button>
            ) : (
              <>
                <time dateTime={new Date(m.createdAt).toISOString()}>{m.pending ? "Sending…" : messageTime(m.createdAt)}</time>
                {receipt && <span className="text-muted/80">· {receipt}</span>}
              </>
            )}
          </span>
        )}
      </div>

      {/* Hover toolbar (pointer devices) */}
      {!m.pending && !m.failed && (
        <div
          className={cn(
            "pointer-events-none absolute -top-4 z-[2] flex items-center gap-0.5 rounded-xl border border-line bg-panel p-0.5 opacity-0 shadow-lg transition max-[1023px]:hidden",
            "group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
            (picker || more) && "pointer-events-auto opacity-100",
            own ? "right-5 sm:right-6" : "left-12 sm:left-14",
          )}
        >
          {QUICK.map((e) => (
            <button key={e} type="button" onClick={() => actions.react(m, e)} aria-label={`React ${e}`} className="grid size-7 place-items-center rounded-lg text-base transition hover:scale-110 hover:bg-panel-2">{e}</button>
          ))}
          <ToolbarButton ref={pickerBtn} label="More reactions" onClick={() => setPicker((p) => !p)}><SmilePlus /></ToolbarButton>
          <ToolbarButton label="Reply" onClick={() => actions.reply(m)}><CornerUpLeft /></ToolbarButton>
          <ToolbarButton ref={moreBtn} label="More actions" onClick={() => setMore((p) => !p)}><MoreHorizontal /></ToolbarButton>
        </div>
      )}

      <Popover anchor={pickerBtn.current} open={picker} onClose={() => setPicker(false)} label="Reactions" className="min-w-0">
        <div className="grid grid-cols-5 gap-0.5">
          {REACTIONS.map((e) => (
            <button key={e} type="button" role="menuitem" onClick={() => { actions.react(m, e); setPicker(false) }} className="grid size-9 place-items-center rounded-lg text-xl outline-none transition hover:bg-panel-2 focus-visible:bg-panel-2">{e}</button>
          ))}
        </div>
      </Popover>
      <Popover anchor={moreBtn.current} open={more} onClose={() => setMore(false)} label="Message actions">
        <MenuItem icon={<CornerUpLeft />} onSelect={() => { setMore(false); actions.reply(m) }}>Reply</MenuItem>
        <MenuItem icon={<Copy />} onSelect={copy}>Copy text</MenuItem>
        {own && <MenuItem icon={<Pencil />} shortcut="↑" onSelect={() => { setMore(false); actions.edit(m) }}>Edit</MenuItem>}
        {own && <MenuItem icon={<Trash2 />} danger onSelect={() => { setMore(false); actions.remove(m) }}>Delete</MenuItem>}
      </Popover>

      {/* Long-press sheet (touch devices) */}
      <Sheet open={sheet} onClose={() => setSheet(false)} label="Message actions">
        <div className="mb-3 flex justify-between gap-1 rounded-2xl bg-panel-2 p-2">
          {REACTIONS.slice(0, 7).map((e) => (
            <button key={e} type="button" onClick={() => { actions.react(m, e); setSheet(false) }} className="grid size-10 place-items-center rounded-xl text-2xl active:scale-90">{e}</button>
          ))}
        </div>
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-panel-2">
          <SheetAction icon={<CornerUpLeft />} onClick={() => { setSheet(false); actions.reply(m) }}>Reply</SheetAction>
          <SheetAction icon={<Copy />} onClick={copy}>Copy text</SheetAction>
          {own && <SheetAction icon={<Pencil />} onClick={() => { setSheet(false); actions.edit(m) }}>Edit</SheetAction>}
          {own && <SheetAction icon={<Trash2 />} danger onClick={() => { setSheet(false); actions.remove(m) }}>Delete</SheetAction>}
        </div>
      </Sheet>
    </div>
  )
})

const ToolbarButton = React.forwardRef<HTMLButtonElement, { label: string; onClick: () => void; children: React.ReactNode }>(function ToolbarButton({ label, onClick, children }, ref) {
  return (
    <button ref={ref} type="button" onClick={onClick} aria-label={label} title={label} className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-text [&_svg]:size-4">
      {children}
    </button>
  )
})

function SheetAction({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-panel", danger ? "text-danger" : "text-text")}>
      <span className="[&_svg]:size-5">{icon}</span>{children}
    </button>
  )
}
