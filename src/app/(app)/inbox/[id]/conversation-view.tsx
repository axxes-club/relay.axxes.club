"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import { ArrowLeft, Send, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { getPusherClient, PUSHER_EVENTS } from "@/lib/pusher/client"
import { useSession } from "@/lib/auth/client"
import { sendMessage, markAsRead } from "@/lib/actions/messaging"

interface Participant {
  userId: string
  name: string
  image: string | null
  isAdmin: boolean | null
}

interface Message {
  id: string
  content: string
  contentType: string
  senderId: string
  createdAt: Date
  sender?: {
    id?: string
    name?: string
    image?: string | null
  }
}

export interface Conversation {
  id: string
  type: "direct" | "group"
  name: string | null
  avatarUrl: string | null
  participants: Participant[]
  unreadCount: number
}

interface ConversationViewProps {
  conversation: Conversation
}

export function ConversationView({ conversation }: ConversationViewProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [newMessage, setNewMessage] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSending, setIsSending] = React.useState(false)
  const [typingUsers, setTypingUsers] = React.useState<Map<string, string>>(new Map())
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const lastTypingEventRef = React.useRef<number>(0)

  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== session?.user?.id
  )

  const conversationName =
    conversation.type === "group"
      ? conversation.name || "Group Chat"
      : otherParticipant?.name || "Direct Message"

  const conversationAvatar =
    conversation.type === "group"
      ? conversation.avatarUrl
      : otherParticipant?.image

  // Load messages
  React.useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`/api/v1/conversations/${conversation.id}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.data?.messages || [])
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadMessages()
  }, [conversation.id])

  // Mark as read on mount and when new messages arrive
  React.useEffect(() => {
    if (conversation.unreadCount > 0) {
      markAsRead(conversation.id)
    }
  }, [conversation.id, conversation.unreadCount])

  // Subscribe to Pusher events
  React.useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(`private-conversation-${conversation.id}`)

    channel.bind(PUSHER_EVENTS.NEW_MESSAGE, (message: Message) => {
      setMessages((prev) => [...prev, message])
      // Mark as read since user is viewing the conversation
      markAsRead(conversation.id)
    })

    channel.bind(
      PUSHER_EVENTS.TYPING_START,
      (data: { userId: string; userName: string }) => {
        if (data.userId !== session?.user?.id) {
          setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName))
        }
      }
    )

    channel.bind(PUSHER_EVENTS.TYPING_STOP, (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev)
        next.delete(data.userId)
        return next
      })
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-conversation-${conversation.id}`)
    }
  }, [conversation.id, session?.user?.id])

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleTyping = async () => {
    const now = Date.now()
    // Only send typing event every 2 seconds
    if (now - lastTypingEventRef.current < 2000) return
    lastTypingEventRef.current = now

    try {
      await fetch(`/api/v1/conversations/${conversation.id}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping: true }),
      })
    } catch (error) {
      console.error("Failed to send typing event:", error)
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/v1/conversations/${conversation.id}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isTyping: false }),
        })
      } catch (error) {
        console.error("Failed to send typing stop event:", error)
      }
    }, 3000)
  }

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    const messageContent = newMessage.trim()
    setNewMessage("")

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    try {
      await fetch(`/api/v1/conversations/${conversation.id}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping: false }),
      })
    } catch {
      // Ignore typing stop errors
    }

    try {
      await sendMessage(conversation.id, { content: messageContent, contentType: "text" })
      router.refresh()
    } catch (error) {
      console.error("Failed to send message:", error)
      setNewMessage(messageContent)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatMessageDate = (date: Date) => {
    const d = new Date(date)
    if (isToday(d)) {
      return format(d, "h:mm a")
    }
    if (isYesterday(d)) {
      return `Yesterday ${format(d, "h:mm a")}`
    }
    return format(d, "MMM d, h:mm a")
  }

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ""

    messages.forEach((message) => {
      const d = new Date(message.createdAt)
      let dateStr: string
      if (isToday(d)) {
        dateStr = "Today"
      } else if (isYesterday(d)) {
        dateStr = "Yesterday"
      } else {
        dateStr = format(d, "MMMM d, yyyy")
      }

      if (dateStr !== currentDate) {
        currentDate = dateStr
        groups.push({ date: dateStr, messages: [] })
      }
      groups[groups.length - 1].messages.push(message)
    })

    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inbox">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversationAvatar || undefined} />
          <AvatarFallback>
            {conversation.type === "group" ? (
              <Users className="h-5 w-5" />
            ) : (
              conversationName[0]?.toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{conversationName}</h1>
          {conversation.type === "group" && (
            <p className="text-xs text-muted-foreground">
              {conversation.participants.length} members
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messageGroups.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.messages.map((message) => {
                    const isOwn = message.senderId === session?.user?.id
                    const sender = isOwn
                      ? { name: session?.user?.name, image: session?.user?.image }
                      : message.sender || conversation.participants.find(
                          (p) => p.userId === message.senderId
                        )

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          isOwn && "flex-row-reverse"
                        )}
                      >
                        {!isOwn && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={sender?.image || undefined} />
                            <AvatarFallback>
                              {(sender?.name || "?")[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "flex flex-col max-w-[70%]",
                            isOwn && "items-end"
                          )}
                        >
                          {!isOwn && conversation.type === "group" && (
                            <span className="text-xs text-muted-foreground mb-1">
                              {sender?.name}
                            </span>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2",
                              isOwn
                                ? "bg-club text-club-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            {formatMessageDate(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Typing indicator */}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 mt-4 text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs">
              {Array.from(typingUsers.values()).join(", ")}{" "}
              {typingUsers.size === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="pt-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              handleTyping()
            }}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
