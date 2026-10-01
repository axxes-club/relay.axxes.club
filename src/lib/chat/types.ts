/** Shapes shared by the Relay inbox, thread and realtime handlers. */

export type Person = { id: string; name: string; image: string | null }

export type Participant = {
  userId: string
  name: string
  image: string | null
  isAdmin: boolean | null
  lastReadAt?: string | Date | null
}

export type InboxConversation = {
  id: string
  type: "direct" | "group"
  name: string | null
  title: string
  avatarUrl: string | null
  lastMessageAt: string | Date | null
  lastMessagePreview: string | null
  unreadCount: number
  isMuted: boolean | null
  isPinned: boolean | null
  participants: Participant[]
  others: Participant[]
}

export type ReplyRef = {
  id: string
  content: string
  senderId: string
  sender?: { id?: string; name?: string | null } | null
} | null

export type ChatMessage = {
  id: string
  conversationId?: string
  content: string
  contentType?: string | null
  senderId: string
  createdAt: string | Date
  isEdited?: boolean | null
  editedAt?: string | Date | null
  replyToId?: string | null
  replyTo?: ReplyRef
  metadata?: { reactions?: Record<string, string[]> } & Record<string, unknown>
  sender?: { id?: string; name?: string | null; image?: string | null } | null
  /** Client-only: shown immediately, replaced when the server confirms. */
  pending?: boolean
  failed?: boolean
}

export type ThreadConversation = {
  id: string
  type: "direct" | "group"
  name: string | null
  avatarUrl: string | null
  description?: string | null
  participants: Participant[]
  unreadCount: number
  isMuted: boolean | null
  isPinned: boolean | null
  selfId: string
}
