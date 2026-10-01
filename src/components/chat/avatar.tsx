import { cn } from "@/lib/utils"

// Hues chosen to read on the dark panel and stay distinct from each other.
const HUES = [212, 262, 330, 18, 42, 152, 188, 290]

function hueFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-12 text-base" }

/** A person (or group) avatar: their image, or initials on a stable per-person color. */
export function Avatar({ name, image, seed, size = "md", className }: { name: string; image?: string | null; seed?: string; size?: keyof typeof SIZES; className?: string }) {
  const hue = hueFor(seed ?? name)
  return (
    <span
      aria-hidden
      className={cn("relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold", SIZES[size], className)}
      style={{ background: `hsl(${hue} 55% 22%)`, color: `hsl(${hue} 85% 82%)` }}
    >
      {image ? <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : size === "xs" ? initials(name).slice(0, 1) : initials(name)}
    </span>
  )
}

/** Two overlapping avatars for a group conversation. */
export function GroupAvatar({ people, seed, size = "md" }: { people: { name: string; image?: string | null; userId?: string }[]; seed: string; size?: "sm" | "md" | "lg" }) {
  const [a, b] = people
  if (!a) return <Avatar name="Group" seed={seed} size={size} />
  if (!b) return <Avatar name={a.name} image={a.image} seed={a.userId ?? a.name} size={size} />
  const box = { sm: "size-8", md: "size-10", lg: "size-12" }[size]
  return (
    <span aria-hidden className={cn("relative inline-block shrink-0", box)}>
      <Avatar name={a.name} image={a.image} seed={a.userId ?? a.name} size="xs" className="absolute left-0 top-0 size-[66%] ring-2 ring-panel" />
      <Avatar name={b.name} image={b.image} seed={b.userId ?? b.name} size="xs" className="absolute bottom-0 right-0 size-[66%] ring-2 ring-panel" />
    </span>
  )
}
