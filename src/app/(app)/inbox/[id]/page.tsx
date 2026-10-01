import { notFound } from "next/navigation"
import { getConversation } from "@/lib/actions/messaging"
import { Thread } from "@/components/chat/thread"
import type { ThreadConversation } from "@/lib/chat/types"

export const dynamic = "force-dynamic"

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversation = await getConversation(id).catch(() => null)
  if (!conversation) notFound()
  const thread: ThreadConversation = {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    avatarUrl: conversation.avatarUrl,
    description: conversation.description,
    participants: conversation.participants,
    unreadCount: conversation.unreadCount,
    isMuted: conversation.isMuted,
    isPinned: conversation.isPinned,
    selfId: conversation.selfId,
  }
  // Keyed by id so switching conversations starts a fresh thread.
  return <Thread key={thread.id} conversation={thread} />
}
