import { getConversations } from "@/lib/actions/messaging"
import { ConversationList } from "./conversation-list"

export const dynamic = "force-dynamic"

/**
 * The inbox.
 *
 * Fetched on the server so the first paint already has the conversations rather
 * than a spinner; the client component takes over for everything after that.
 */
export default async function InboxPage() {
  const conversations = await getConversations()
  return (
    <div className="h-[calc(100vh-4rem)]">
      <ConversationList initialConversations={conversations} />
    </div>
  )
}
