import { NextRequest, NextResponse } from "next/server"
import { withTenantAccess } from "@/lib/auth/tenant-context"
import { db } from "@/lib/db"
import { conversationParticipants, messages } from "@/lib/db/schema"
import { eq, and, desc, isNull } from "drizzle-orm"
import {
  getPusherServer,
  getConversationChannel,
  PUSHER_EVENTS,
} from "@/lib/pusher/server"

// POST /api/v1/conversations/[id]/read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  return withTenantAccess(request, async (tenantId, userId) => {
    // Get the latest message
    const latestMessage = await db.query.messages.findFirst({
      where: and(
        eq(messages.conversationId, conversationId),
        isNull(messages.deletedAt)
      ),
      orderBy: desc(messages.createdAt),
    })

    // Update participant's read status
    const [participant] = await db
      .update(conversationParticipants)
      .set({
        lastReadAt: new Date(),
        lastReadMessageId: latestMessage?.id || null,
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      )
      .returning()

    if (!participant) {
      return NextResponse.json(
        { success: false, error: { message: "Not a participant" } },
        { status: 403 }
      )
    }

    // Trigger read receipt event
    try {
      const pusher = getPusherServer()
      await pusher.trigger(
        getConversationChannel(conversationId),
        PUSHER_EVENTS.MESSAGE_READ,
        {
          userId,
          conversationId,
          lastReadMessageId: latestMessage?.id,
          readAt: new Date().toISOString(),
        }
      )
    } catch (error) {
      console.error("Pusher trigger failed:", error)
    }

    return NextResponse.json({ success: true, data: { unreadCount: 0 } })
  })
}
