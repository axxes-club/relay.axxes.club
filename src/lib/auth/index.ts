import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"
import { loginActivity } from "@/lib/db/schema"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { sendPasswordResetEmail } from "@/lib/email"

// With Handshake (handshake.axxes.club), every *.axxes.club app shares one session cookie
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN
const parentDomain = (cookieDomain || "axxes.club").replace(/^\./, "")

/**
 * Extra origins, for running against a Handshake on your own machine.
 *
 * Without this, `next dev` cannot complete a sign-in: the callback comes back
 * from `http://localhost:3101`, which matches neither `https://axxes.club` nor
 * `https://*.axxes.club`, so Better Auth rejects it as an untrusted origin and
 * you land back on the sign-in page with no error explaining why.
 *
 * The list is opt-in through EXTRA_TRUSTED_ORIGINS and is empty by default,
 * so production keeps trusting exactly the real domains and nothing else.
 * Handshake must be listed here too, not just this app: it is the one issuing
 * the callback.
 */
const extraOrigins = (process.env.EXTRA_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const trustedOrigins = [
  `https://${parentDomain}`,
  `https://*.${parentDomain}`,
  ...extraOrigins,
]

// Central AXXES sign-in; when unset the portal uses its own sign-in pages
export const HANDSHAKE_URL = process.env.HANDSHAKE_URL?.replace(/\/$/, "") || null

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL || "http://localhost:3000",
  trustedOrigins,
  advanced: cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        email: user.email,
        resetLink: url,
      })
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Log login event when a new session is created
          try {
            await db.insert(loginActivity).values({
              userId: session.userId,
              eventType: "login",
              ipAddress: session.ipAddress || null,
              userAgent: session.userAgent || null,
              metadata: {},
            })
          } catch (error) {
            // Don't fail auth if logging fails
            console.error("Failed to log login activity:", error)
          }
        },
      },
    },
  },
})

export async function getAuthContext() {
  const cookieStore = await cookies()
  const tenantId = cookieStore.get("tenant_id")?.value

  // Build cookie header string from all cookies
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: new Headers({
      cookie: cookieHeader,
    }),
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  if (!tenantId) {
    redirect("/onboarding")
  }

  return { userId: session.user.id, tenantId }
}

export type Session = typeof auth.$Infer.Session
