import { ImageResponse } from "next/og"

const SIZES = new Set([48, 72, 96, 128, 144, 180, 192, 256, 384, 512])

/**
 * Relay's app icon, drawn at the size asked for. `?maskable=1` keeps the glyph
 * inside the 80% safe zone so Android's circular/squircle masks don't clip it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192
  const maskable = new URL(request.url).searchParams.has("maskable")
  const glyph = Math.round(size * (maskable ? 0.46 : 0.56))
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #6e9bff 0%, #3f6ff0 100%)",
          borderRadius: maskable ? 0 : Math.round(size * 0.225),
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#06070c" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="#06070c" fillOpacity={0.12} />
          <path d="M8.5 11.5h7M8.5 14.5h4" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  )
}
