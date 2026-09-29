import { NextRequest, NextResponse } from "next/server"
import { withTenantAccess } from "@/lib/auth/tenant-context"
import { db } from "@/lib/db"
import {
  messages,
  conversations,
  conversationParticipants,
  user,
} from "@/lib/db/schema"
import { eq, and, desc, sql, lt, ne, isNull } from "drizzle-orm"
import {
  getPusherServer,
  getConversationChannel,
  getUserChannel,
  PUSHER_EVENTS,
} from "@/lib/pusher/server"

// GET /api/v1/conversations/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  return withTenantAccess(request, async (tenantId, userId) => {
    // Verify participation
    const participant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt)
      ),
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: { message: "Access denied" } },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const cursor = searchParams.get("cursor")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    const conditions = [
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
    ]

    if (cursor) {
      conditions.push(lt(messages.createdAt, new Date(cursor)))
    }

    const messageList = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: desc(messages.createdAt),
      limit: limit + 1,
      with: {
        sender: true,
        replyTo: {
          with: {
            sender: true,
          },
        },
      },
    })

    const hasMore = messageList.length > limit
    const data = hasMore ? messageList.slice(0, -1) : messageList

    return NextResponse.json({
      success: true,
      data: data.reverse(), // Return in chronological order
      nextCursor: hasMore ? data[0]?.createdAt?.toISOString() : null,
    })
  })
}

// POST /api/v1/conversations/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  return withTenantAccess(request, async (tenantId, userId) => {
    // Verify participation
    const participant = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt)
      ),
      with: {
        conversation: true,
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: { message: "Access denied" } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { content, contentType = "text", replyToId, attachments = [] } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Message content required" } },
        { status: 400 }
      )
    }

    // Create message
    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        tenantId,
        content: content.trim(),
        contentType,
        senderId: userId,
        replyToId,
        attachments,
      })
      .returning()

    // Get sender info
    const sender = await db.query.user.findFirst({
      where: eq(user.id, userId),
    })

    const messageWithSender = {
      ...message,
      sender: {
        id: sender?.id,
        name: sender?.name,
        image: sender?.image,
      },
    }

    // Update conversation
    const preview =
      content.length > 100 ? content.substring(0, 100) + "..." : content
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))

    // Update unread counts for other participants
    await db
      .update(conversationParticipants)
      .set({
        unreadCount: sql`${conversationParticipants.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          ne(conversationParticipants.userId, userId),
          isNull(conversationParticipants.leftAt)
        )
      )

    // Get all participants for notifications
    const participants = await db.query.conversationParticipants.findMany({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        isNull(conversationParticipants.leftAt)
      ),
    })

    // Trigger Pusher events
    try {
      const pusher = getPusherServer()

      // 1. Send to conversation channel
      await pusher.trigger(
        getConversationChannel(conversationId),
        PUSHER_EVENTS.NEW_MESSAGE,
        messageWithSender
      )

      // 2. Send unread count updates to other users
      for (const p of participants) {
        if (p.userId !== userId) {
          await pusher.trigger(
            getUserChannel(p.userId),
            PUSHER_EVENTS.UNREAD_COUNT_UPDATED,
            {
              conversationId,
              unreadCount: p.unreadCount + 1,
            }
          )
        }
      }
    } catch (error) {
      // Don't fail the request if Pusher fails
      console.error("Pusher trigger failed:", error)
    }

    return NextResponse.json({ success: true, data: messageWithSender })
  })
}
