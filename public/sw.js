/* Relay service worker.
 *
 * - Static build assets (/_next/static, icons, fonts): cache-first. They are
 *   content-hashed, so a cached copy is never stale.
 * - Pages: network only, with an offline page when there is no connection.
 *   Pages contain message previews, so they are never stored on the device —
 *   nothing personal survives sign-out in this cache, and nobody is shown
 *   yesterday's inbox as if it were current.
 * - API, auth, realtime: never cached, never intercepted.
 */
const VERSION = "relay-v1"
const STATIC = `${VERSION}-static`
const OFFLINE = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/192", "/icons/512"])).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sign-") || url.searchParams.has("_rsc")) return

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()))
        return res
      })),
    )
    return
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE)),
    )
  }
})

// Clicking a notification focuses Relay (or opens it) on that conversation.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/inbox"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
