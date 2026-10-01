"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/**
 * A small anchored popover: closes on Escape or an outside click, keeps arrow-key
 * focus inside its items, and returns focus to the trigger. Portaled so it is
 * never clipped by the scrolling message list.
 */
export function Popover({
  anchor,
  open,
  onClose,
  align = "end",
  side = "bottom",
  className,
  children,
  label,
}: {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  align?: "start" | "end"
  side?: "top" | "bottom"
  className?: string
  children: React.ReactNode
  label: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  React.useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return
    const a = anchor.getBoundingClientRect()
    const m = ref.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let top = side === "bottom" ? a.bottom + 6 : a.top - m.height - 6
    if (top + m.height > vh - 8) top = a.top - m.height - 6
    if (top < 8) top = a.bottom + 6
    let left = align === "end" ? a.right - m.width : a.left
    left = Math.max(8, Math.min(left, vw - m.width - 8))
    setPos({ top, left })
  }, [open, anchor, side, align])

  React.useEffect(() => {
    if (!open) return
    const first = ref.current?.querySelector<HTMLElement>("[role=menuitem],button")
    first?.focus()
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); anchor?.focus() }
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])]
        const i = items.indexOf(document.activeElement as HTMLElement)
        if (i < 0) return
        e.preventDefault()
        const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1
        items[(i + step + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open, onClose, anchor])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className={cn("fixed z-[60] min-w-44 rounded-xl border border-line bg-panel p-1 shadow-2xl shadow-black/50 animate-in", className)}
    >
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ icon, children, onSelect, danger, shortcut }: { icon?: React.ReactNode; children: React.ReactNode; onSelect: () => void; danger?: boolean; shortcut?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition hover:bg-panel-2 focus-visible:bg-panel-2",
        danger ? "text-danger" : "text-text",
      )}
    >
      {icon && <span className="grid size-4 shrink-0 place-items-center text-muted [&_svg]:size-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <kbd className="font-mono text-[10px] text-muted">{shortcut}</kbd>}
    </button>
  )
}

/** A bottom sheet for touch: the long-press menu on phones. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60 backdrop-blur-sm animate-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border-t border-line bg-panel px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-sheet"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
