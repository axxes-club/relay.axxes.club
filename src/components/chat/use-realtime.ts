"use client"

import * as React from "react"

/** True when this build has Pusher configured; otherwise the thread polls. */
export const REALTIME = Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER)

type Handlers = Record<string, (data: never) => void>

/**
 * Subscribes to a private Pusher channel for as long as the component is
 * mounted. Handlers are read through a ref, so they always see current state
 * without resubscribing on every render.
 */
export function useChannel(channel: string | null, handlers: Handlers) {
  const ref = React.useRef(handlers)
  React.useEffect(() => {
    ref.current = handlers
  })
  React.useEffect(() => {
    if (!REALTIME || !channel) return
    let cancelled = false
    let cleanup = () => {}
    import("@/lib/pusher/client").then(({ getPusherClient }) => {
      if (cancelled) return
      const pusher = getPusherClient()
      const ch = pusher.subscribe(channel)
      const bound = Object.keys(ref.current).map((event) => {
        const fn = (data: never) => ref.current[event]?.(data)
        ch.bind(event, fn)
        return [event, fn] as const
      })
      cleanup = () => {
        bound.forEach(([event, fn]) => ch.unbind(event, fn))
        pusher.unsubscribe(channel)
      }
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [channel])
}
