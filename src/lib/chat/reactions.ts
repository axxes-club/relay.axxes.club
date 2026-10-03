/** Reactions people can add. A fixed set keeps them meaningful and the column small. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "🙌", "👀", "✅", "😮", "🙏"] as const
export type Reaction = (typeof REACTIONS)[number]
