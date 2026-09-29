import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

import { getConversation } from "@/lib/actions/messaging"
import { ConversationView, type Conversation } from "./conversation-view"

interface ConversationPageProps {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id } = await params

  const conversation = await getConversation(id).catch(() => null)

  if (!conversation) {
    notFound()
  }

  return <ConversationView conversation={conversation as Conversation} />
}
