import type { MetadataRoute } from "next"

/** Makes Relay installable: its own window, icon, dock badge and a "New message" shortcut. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/inbox",
    name: "Relay · AXXES",
    short_name: "Relay",
    description: "Team messaging for your AXXES workspace: direct and group conversations, in real time.",
    start_url: "/inbox?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    categories: ["business", "productivity", "social"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New message", short_name: "New", url: "/inbox/new?source=pwa", icons: [{ src: "/icons/96", sizes: "96x96", type: "image/png" }] },
      { name: "Messages", url: "/inbox?source=pwa", icons: [{ src: "/icons/96", sizes: "96x96", type: "image/png" }] },
    ],
  }
}
