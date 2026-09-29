import type { Resource } from "@/lib/resource"

export type Product = {
  /** Codename shown in the UI. */
  name: string
  tagline: string
  /**
   * One paragraph, used on the marketing page and in the product catalog.
   * Optional: an internal tool with no marketing surface does not need one.
   */
  description?: string
  /** Brand accent (CSS color). */
  accent: string
  /** Extra top-level pages, listed above resources. */
  nav?: { href: string; label: string }[]
  /**
   * AXXES Folders integration. See `src/lib/folders.ts` — an app that sets
   * `appKey` gets "Open in <app>" on every file in a folder for free.
   */
  folders?: import("@/lib/folders").AppConfig
  resources: Resource[]
}

export function defineProduct(p: Product) {
  return p
}
