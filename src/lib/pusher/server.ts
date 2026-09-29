import Pusher from "pusher"

// Pusher server instance - only instantiated when env vars are available
let pusherInstance: Pusher | null = null

export function getPusherServer(): Pusher {
  if (pusherInstance) return pusherInstance

  if (
    !process.env.PUSHER_APP_ID ||
    !process.env.PUSHER_KEY ||
    !process.env.PUSHER_SECRET ||
    !process.env.PUSHER_CLUSTER
  ) {
    throw new Error(
      "Missing Pusher environment variables. Please set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, and PUSHER_CLUSTER."
    )
  }

  pusherInstance = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  })

  return pusherInstance
}

// Channel naming conventions
export const getConversationChannel = (conversationId: string) =>
  `private-conversation-${conversationId}`

export const getUserChannel = (userId: string) => `private-user-${userId}`

export const getTenantChannel = (tenantId: string) =>
  `private-tenant-${tenantId}`

// Event types
export const PUSHER_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_READ: "message-read",
  TYPING_START: "typing-start",
  TYPING_STOP: "typing-stop",
  CONVERSATION_UPDATED: "conversation-updated",
  UNREAD_COUNT_UPDATED: "unread-count-updated",
} as const

export type PusherEventType = (typeof PUSHER_EVENTS)[keyof typeof PUSHER_EVENTS]
