import { product } from "@/product.config"
import Link from "next/link"

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
    title: "Direct and group conversations",
    body: "One person or a team, in the same inbox. Nothing to install and no second account to create — an AXXES account is the account.",
  },
  {
    title: "Realtime, not polling",
    body: "Messages, typing indicators and unread counts arrive over Pusher, so the conversation is live rather than catching up when you refresh.",
  },
  {
    title: "Read receipts and unread counts",
    body: "Know what has been seen and what has not. The same numbers drive the badge in the members portal sidebar, so both surfaces agree.",
  },
  {
    title: "A REST API",
    body: "The same conversations and messages over /api/v1, scoped to your organization. Build a bot, a digest or an integration against it.",
  },
  {
    title: "One shared session",
    body: "Sign in once at axxes.club. Relay trusts the shared AXXES cookie and never asks for a password of its own.",
  },
  {
    title: "Native to the portal, and standalone",
    body: "It lives inside the members portal where your team already is, and it is also its own product on its own domain. Same data, either way.",
  },
]

export default function RelayMarketing() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
      <section className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
          AXXES
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight lg:text-5xl">
          {product.name}
        </h1>
        <p className="mt-4 text-lg text-muted">{product.tagline}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {product.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-in" className="btn-primary">
            Sign in with AXXES
          </Link>
          <Link href="/api-docs" className="btn-ghost">
            Read the API
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="rounded-lg border border-line p-5">
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-xs text-muted">
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
