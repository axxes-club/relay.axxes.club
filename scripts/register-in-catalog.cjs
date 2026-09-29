const fs = require("fs")
const { neon } = require("@neondatabase/serverless")
const url = fs.readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n]+)"?/)[1]
const sql = neon(url)

/**
 * Register Relay in the shared product catalog.
 *
 * The catalog is the one list every launcher reads, so an app that is not in
 * it is live in one place and invisible in another - the exact drift the table
 * exists to prevent.
 */
const row = {
  key: "relay",
  name: "Relay",
  tagline: "Conversations that live where your team already works.",
  description:
    "Direct and group messaging with read receipts, unread counts, typing indicators and realtime delivery. Signs in with your AXXES account, works inside the members portal, and exposes the same conversations over a REST API.",
  url: "https://relay.axxes.club",
  color: "#c8ff3d",
  category: "Work",
  status: "beta",
  sso: true,
  icon: "MessageSquare",
  membersPath: "/messages",
  surfaceInMembers: true,
}

;(async () => {
  const existing = await sql`SELECT key FROM axxes_product WHERE key = ${row.key}`
  if (existing.length) {
    await sql`
      UPDATE axxes_product SET
        name = ${row.name}, tagline = ${row.tagline}, description = ${row.description},
        url = ${row.url}, color = ${row.color}, category = ${row.category},
        status = ${row.status}, sso = ${row.sso}, icon = ${row.icon},
        members_path = ${row.membersPath}, surface_in_members = ${row.surfaceInMembers},
        updated_at = now()
      WHERE key = ${row.key}`
    console.log("updated:", row.key)
  } else {
    const next = await sql`SELECT coalesce(max(sort_order), 0) + 1 AS n FROM axxes_product`
    await sql`
      INSERT INTO axxes_product
        (key, name, tagline, description, url, color, category, status, sso, icon,
         members_path, surface_in_members, sort_order)
      VALUES (${row.key}, ${row.name}, ${row.tagline}, ${row.description}, ${row.url},
              ${row.color}, ${row.category}, ${row.status}, ${row.sso}, ${row.icon},
              ${row.membersPath}, ${row.surfaceInMembers}, ${next[0].n})`
    console.log("inserted:", row.key, "at sort_order", next[0].n)
  }
  const all = await sql`SELECT count(*)::int n FROM axxes_product`
  console.log("catalog now holds", all[0].n, "products")
})().catch((e) => {
  console.log("ERR:", e.message)
  process.exit(1)
})
