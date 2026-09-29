import { product } from "@/product.config"

export const dynamic = "force-static"

/**
 * The API reference.
 *
 * Written by hand rather than generated, because the thing worth documenting
 * here is not the shape of a response but the rule that matters: every route is
 * scoped to the caller's organization. A reader who takes one sentence away
 * should take that one.
 */
const ROUTES = [
  {
    method: "GET",
    path: "/api/v1/conversations",
    summary: "Every conversation you are a member of, most recently active first.",
    notes: "Each item carries the participant list and your own unread count for it.",
  },
  {
    method: "POST",
    path: "/api/v1/conversations",
    summary: "Start a conversation.",
    notes: "Body takes a type of direct or group, the participant ids, and a name for a group.",
  },
  {
    method: "GET",
    path: "/api/v1/conversations/{id}/messages",
    summary: "The messages in a conversation, oldest first.",
    notes: "Requires membership of that conversation. A conversation id from another organization is not found, not forbidden.",
  },
  {
    method: "POST",
    path: "/api/v1/conversations/{id}/messages",
    summary: "Send a message.",
    notes: "Delivered over Pusher to everyone else in the conversation as it happens.",
  },
  {
    method: "POST",
    path: "/api/v1/conversations/{id}/read",
    summary: "Mark a conversation read up to this point.",
    notes: "Clears your unread count for it and updates your last-read marker.",
  },
  {
    method: "POST",
    path: "/api/v1/conversations/{id}/typing",
    summary: "Publish or clear your typing indicator.",
    notes: "Ephemeral. Nothing is stored; other members see it live and it expires on its own.",
  },
]

const METHOD_STYLE: Record<string, string> = {
  GET: "text-muted",
  POST: "text-accent",
}

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
        {product.name}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">API reference</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The same conversations the inbox uses, over HTTP. Sign in with your AXXES
        account first: every route below requires a session and is scoped to the
        organization you are in. A conversation that belongs to another organization
        is reported as not found rather than forbidden, so an id cannot be probed.
      </p>

      <ul className="mt-10 space-y-6">
        {ROUTES.map((r) => (
          <li key={`${r.method} ${r.path}`} className="border-b border-line pb-6 last:border-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className={`font-mono text-[11px] font-semibold ${METHOD_STYLE[r.method] ?? ""}`}
              >
                {r.method}
              </span>
              <code className="text-sm">{r.path}</code>
            </div>
            <p className="mt-2 text-sm">{r.summary}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{r.notes}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-lg border border-line p-5">
        <h2 className="text-sm font-semibold">Versioning</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A breaking change gets a new path. An additive one does not. Responses carry
          a date header so you can tell which you are talking to.
        </p>
      </div>
    </main>
  )
}
