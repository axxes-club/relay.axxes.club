/** Realtime event names. Mirrors PUSHER_EVENTS in lib/pusher/server without importing server code into the browser. */
export const EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_READ: "message-read",
  TYPING_START: "typing-start",
  TYPING_STOP: "typing-stop",
  UNREAD_COUNT_UPDATED: "unread-count-updated",
  MESSAGE_UPDATED: "message-updated",
  MESSAGE_DELETED: "message-deleted",
} as const

export const conversationChannel = (id: string) => `private-conversation-${id}`
export const userChannel = (id: string) => `private-user-${id}`
