import Link from "next/link"
import { MessagesSquare } from "lucide-react"

export const dynamic = "force-dynamic"

/** Desktop: the thread pane before a conversation is chosen. (Phones show the list instead.) */
export default function InboxPage() {
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent/12 text-accent">
          <MessagesSquare className="size-8" />
        </span>
        <h2 className="mt-5 text-xl font-semibold tracking-tight">Pick a conversation</h2>
        <p className="mt-2 text-sm text-muted">Choose one on the left, or start something new. Press <kbd className="rounded border border-line px-1 font-mono text-xs">⌘K</kbd> to jump to anyone.</p>
        <Link href="/inbox/new" className="btn-primary mt-6">New message</Link>
      </div>
    </div>
  )
}
