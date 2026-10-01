import { defineProduct } from "@/lib/product"

/**
 * Relay — messaging for teams that ship.
 *
 * Ordered the way a person arrives rather than the way the schema is laid out:
 * see what is being said, then start something new. Reference (the API) sits
 * near the bottom on purpose — a page you read once per call is not a page you
 * navigate through.
 */
export const product = defineProduct({
  name: "Relay",
  tagline: "Conversations that live where your team already works.",
  accent: "#5b8cff", // AXXES.work blue (brand book v2)
  description:
    "Relay is AXXES messaging: direct and group conversations, read receipts, unread counts, typing indicators and realtime delivery. It signs in with your AXXES account, mounts inside the members portal, and is also available on its own domain with a public REST API.",
  nav: [
    { href: "/inbox", label: "Messages" },
    { href: "/inbox/new", label: "New message" },
    { href: "/api-docs", label: "API reference" },
  ],
  resources: [],
})
