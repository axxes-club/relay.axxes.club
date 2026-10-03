"use client"

import * as React from "react"

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    emit()
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    emit()
  })
}

/** The browser's install prompt, when there is one and Relay isn't already installed. */
export function useInstall() {
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    listeners.add(force)
    return () => { listeners.delete(force) }
  }, [])
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches)
  return {
    available: !!deferred && !standalone,
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => null)
      deferred = null
      emit()
    },
  }
}

/** Registers the service worker once, in production builds only. */
export function ServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  }, [])
  return null
}
