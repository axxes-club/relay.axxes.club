import { product } from "@/product.config"
import Link from "next/link"
import { MessagesSquare, Zap, CheckCheck, Code2, KeyRound, LayoutPanelLeft } from "lucide-react"

/**
 * Relay's marketing site.
 *
 * Sits outside the authenticated shell so the product can be sold to somebody
 * who does not have an account yet. It states plainly what the thing is and
 * who it is for, then points at sign-in. Everything it claims is something the
 * product actually does today — a landing page that overstates is worse than
 * no landing page.
 */
export const dynamic = "force-static"

const CAPABILITIES = [
  {
    icon: MessagesSquare,
    title: "Direct and group conversations",
    body: "One person or a team, in the same inbox. Nothing to install and no second account to create — an AXXES account is the account.",
  },
  {
    icon: Zap,
    title: "Realtime, not polling",
    body: "Messages, typing indicators and unread counts arrive over Pusher, so the conversation is live rather than catching up when you refresh.",
  },
  {
    icon: CheckCheck,
    title: "Read receipts and unread counts",
    body: "Know what has been seen and what has not. The same numbers drive the badge in the members portal sidebar, so both surfaces agree.",
  },
  {
    icon: Code2,
    title: "A REST API",
    body: "The same conversations and messages over /api/v1, scoped to your organization. Build a bot, a digest or an integration against it.",
  },
  {
    icon: KeyRound,
    title: "One shared session",
    body: "Sign in once at axxes.club. Relay trusts the shared AXXES cookie and never asks for a password of its own.",
  },
  {
    icon: LayoutPanelLeft,
    title: "Native to the portal, and standalone",
    body: "It lives inside the members portal where your team already is, and it is also its own product on its own domain. Same data, either way.",
  },
]

/** Sample messages for the illustration only; labelled as such on the page. */
const SAMPLE = [
  { who: "Maya", text: "Load-in moved to 6pm. Updated the run sheet.", mine: false },
  { who: "You", text: "Got it. I'll tell the door team.", mine: true },
  { who: "Leo", text: "Sound check at 7 then?", mine: false },
]

export default function RelayMarketing() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
      <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="app-tile grid size-14 place-items-center rounded-2xl">
            <MessagesSquare className="size-7" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-medium text-accent">{product.name} by AXXES</p>
          <h1 className="mt-3 text-5xl font-semibold leading-[0.95] tracking-[-0.045em] lg:text-7xl">
            Team chat that stays <span className="bg-gradient-to-r from-text via-accent to-[#9bb6f7] bg-clip-text text-transparent">with the work.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{product.tagline} {product.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in" className="btn-primary px-5 py-3 text-[15px]">
              Sign in with AXXES
            </Link>
            <Link href="/api-docs" className="btn-ghost px-5 py-3 text-[15px]">
              Read the API
            </Link>
          </div>
        </div>

        <figure aria-label="Illustration of a Relay conversation with sample messages" className="card overflow-hidden" style={{ boxShadow: "var(--shadow-lift)" }}>
          <div className="flex items-center gap-2 border-b border-line bg-bg-2 px-4 py-3">
            <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
            <span className="mx-auto rounded-lg bg-panel-2 px-3 py-1 font-mono text-xs text-muted"># event-ops</span>
          </div>
          <div className="space-y-3 p-5">
            {SAMPLE.map((m) => (
              <div key={m.text} className={m.mine ? "flex justify-end" : "flex"}>
                <div className={m.mine ? "max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white" : "max-w-[80%] rounded-2xl rounded-bl-md border border-line bg-panel-2 px-4 py-2.5 text-sm"} style={m.mine ? { background: "linear-gradient(180deg, color-mix(in oklab, var(--accent-deep) 70%, white), var(--accent-deep))" } : undefined}>
                  {!m.mine && <span className="mb-0.5 block text-xs font-medium text-accent">{m.who}</span>}
                  {m.text}
                </div>
              </div>
            ))}
            <p className="flex items-center gap-2 pt-1 text-xs text-muted"><span className="inline-flex gap-0.5"><span className="size-1.5 animate-pulse rounded-full bg-muted" /><span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" /><span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" /></span>Leo is typing</p>
          </div>
          <figcaption className="border-t border-line px-5 py-2.5 text-[11px] text-muted">Illustration · sample conversation</figcaption>
        </figure>
      </section>

      <section className="mt-24">
        <h2 className="text-3xl font-semibold tracking-[-0.035em] lg:text-4xl">What Relay does today</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="card p-6 transition hover:-translate-y-1 hover:border-line-2">
              <span className="app-tile grid size-10 place-items-center rounded-xl">
                <c.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-line pt-6 text-xs text-muted">
        {product.name} is part of the AXXES suite.{" "}
        <a
          href="https://axxes.club"
          className="underline decoration-dotted underline-offset-4"
        >
          axxes.club
        </a>
      </footer>
    </main>
  )
}
