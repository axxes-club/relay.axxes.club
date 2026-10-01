import * as React from "react"

/**
 * Message text → React nodes. Never HTML: every piece is a React element or a
 * string, so a message cannot inject markup. Supports links, ```code blocks```,
 * `inline code`, **bold** and *italic* — the four things people actually type.
 */

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g
const INLINE_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g

function linkify(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    out.push(
      <a key={`${key}-l${at}`} href={m[0]} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline decoration-current/40 underline-offset-2 hover:decoration-current">
        {m[0].replace(/^https?:\/\//, "")}
      </a>,
    )
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  text.split(INLINE_RE).forEach((part, i) => {
    if (!part) return
    const k = `${key}-${i}`
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) out.push(<code key={k} className="rounded bg-black/25 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>)
    else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) out.push(<strong key={k} className="font-semibold">{linkify(part.slice(2, -2), k)}</strong>)
    else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) out.push(<em key={k}>{linkify(part.slice(1, -1), k)}</em>)
    else out.push(...linkify(part, k))
  })
  return out
}

export function renderMessage(text: string): React.ReactNode {
  const blocks = text.split(/```(?:[a-z0-9-]+\n)?([\s\S]*?)```/g)
  return blocks.map((block, i) =>
    i % 2 === 1 ? (
      <pre key={i} className="my-1 overflow-x-auto rounded-lg bg-black/30 p-2.5 font-mono text-[0.82em] leading-relaxed">
        <code>{block.replace(/\n$/, "")}</code>
      </pre>
    ) : (
      <React.Fragment key={i}>{inline(block, `b${i}`)}</React.Fragment>
    ),
  )
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,24}$/u

/** True for messages that are only a few emoji, which read better large. */
export function isEmojiOnly(text: string) {
  const t = text.trim()
  if (!t || /[0-9#*]/.test(t)) return false
  return EMOJI_ONLY.test(t) && [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)].filter((s) => s.segment.trim()).length <= 3
}

/** Plain-text preview for lists and reply quotes: formatting markers removed. */
export function previewText(text: string, max = 120) {
  const t = text.replace(/```[\s\S]*?```/g, "[code]").replace(/[*`]/g, "").replace(/\s+/g, " ").trim()
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}
