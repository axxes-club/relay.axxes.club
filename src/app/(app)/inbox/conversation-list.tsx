"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPusherClient, PUSHER_EVENTS } from "@/lib/pusher/client"
import { useSession } from "@/lib/auth/client"

interface Participant {
  userId: string
  name: string
  image: string | null
  isAdmin: boolean | null
}

interface Conversation {
  id: string
  type: "direct" | "group"
  name: string | null
  avatarUrl: string | null
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  unreadCount: number
  isMuted: boolean | null
  isPinned: boolean | null
  participants: Participant[]
  createdAt: Date
}

interface ConversationListProps {
  initialConversations: Conversation[]
}

export function ConversationList({ initialConversations }: ConversationListProps) {
  const { data: session } = useSession()
  const [conversations, setConversations] = React.useState(initialConversations)

  React.useEffect(() => {
    if (!session?.user?.id) return

    const pusher = getPusherClient()
    const channel = pusher.subscribe(`private-user-${session.user.id}`)

    channel.bind(
      PUSHER_EVENTS.UNREAD_COUNT_UPDATED,
      (data: { conversationId: string; unreadCount: number }) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === data.conversationId
              ? { ...c, unreadCount: data.unreadCount }
              : c
          )
        )
      }
    )

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-user-${session.user.id}`)
    }
  }, [session?.user?.id])

  const getConversationName = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.name || "Group Chat"
    }
    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== session?.user?.id
    )
    return otherParticipant?.name || "Direct Message"
  }

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.avatarUrl
    }
    const otherParticipant = conversation.participants.find(
      (p) => p.userId !== session?.user?.id
    )
    return otherParticipant?.image
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <Link key={conversation.id} href={`/messages/${conversation.id}`}>
          <Card
            interactive
            className={cn(
              conversation.unreadCount > 0 && "border-club/50 bg-club/5"
            )}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={getConversationAvatar(conversation) || undefined}
                />
                <AvatarFallback>
                  {getConversationName(conversation)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      "font-medium truncate",
                      conversation.unreadCount > 0 && "font-semibold"
                    )}
                  >
                    {getConversationName(conversation)}
                  </h3>
                  {conversation.lastMessageAt && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p
                    className={cn(
                      "text-sm truncate",
                      conversation.unreadCount > 0
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {conversation.lastMessagePreview || "No messages yet"}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="club" className="shrink-0">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
