/** Both names exist in deployed apps; ignore malformed values rather than using them as origins. */
export function resolveAuthBaseURL(env: Record<string, string | undefined>) {
  for (const value of [env.BETTER_AUTH_URL, env.BETTER_AUTH_BASE_URL]) {
    if (!value) continue
    try {
      const url = new URL(value.trim())
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin
    } catch {
      // Try the legacy setting if the canonical setting is malformed.
    }
  }
  return "http://localhost:3000"
}
