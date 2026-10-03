import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { product } from "@/product.config"
import { ServiceWorker } from "@/components/chat/pwa"
import "./globals.css"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: `${product.name} · AXXES`, template: `%s · ${product.name}` },
  description: product.tagline,
  applicationName: product.name,
  appleWebApp: { capable: true, title: product.name, statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/192", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/180", sizes: "180x180" }] },
  formatDetection: { telephone: false },
}

// Phones: draw under the notch, and shrink the page (not overlay it) when the
// keyboard opens so the composer stays visible.
export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ "--product-accent": product.accent } as React.CSSProperties}>
      <body className={`${sans.variable} ${mono.variable} min-h-dvh`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  )
}
