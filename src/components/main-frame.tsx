"use client"

import { usePathname } from "next/navigation"

/**
 * Pages get the usual padded, centered column; messaging gets the whole window,
 * because a chat app that scrolls the page instead of the thread feels broken.
 */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const chat = usePathname().startsWith("/inbox")
  if (chat) return <main className="relay-main flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
  return (
    <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl">{children}</div>
    </main>
  )
}
