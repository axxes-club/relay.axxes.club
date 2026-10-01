import Link from "next/link"
import { getConversations, getTotalUnreadCount } from "@/lib/actions/messaging"
import { requireContext } from "@/lib/context"
import { product } from "@/product.config"

export const dynamic = "force-dynamic"

/**
 * Relay's front door.
 *
 * A person who lands here signed in with an AXXES account and wants to talk to
 * somebody, so the inbox is one click away rather than three. The numbers are
 * the same ones the sidebar shows, computed here so the landing page can stand
 * on its own without the portal chrome.
 */
export default async function OverviewPage() {
  await requireContext()
  const [conversations, unread] = await Promise.all([
    getConversations(),
    getTotalUnreadCount(),
  ])

  const recent = conversations.slice(0, 5)

  return (
    <>
      <section className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-sm text-muted">{product.tagline}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Conversations
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{conversations.length}</p>
        </div>
        <div className="rounded-lg border border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Unread
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{unread}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/inbox" className="btn-primary">
          Open inbox
        </Link>
        <Link href="/new" className="btn-ghost">
          New conversation
        </Link>
        <Link href="/api-docs" className="btn-ghost">
          API reference
        </Link>
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Recent
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/inbox/${c.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-panel-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {c.name || "Direct message"}
                    </span>
                    {c.lastMessagePreview && (
                      <span className="block truncate text-xs text-muted">
                        {c.lastMessagePreview}
                      </span>
                    )}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-black">
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
