import {wrapAdmission} from '@/lib/security/admission-server';
import { NextRequest, NextResponse } from "next/server"
import { withTenantAccess } from "@/lib/auth/tenant-context"
import { db } from "@/lib/db"
import { conversationParticipants, user } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import {
  getPusherServer,
  getConversationChannel,
  PUSHER_EVENTS,
} from "@/lib/pusher/server"

// POST /api/v1/conversations/[id]/typing
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  return withTenantAccess(request, async (tenantId, userId) => {
    const body = await request.json()
    const { isTyping } = body

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

    // Get user info
    const userInfo = await db.query.user.findFirst({
      where: eq(user.id, userId),
    })

    // Trigger typing event
    try {
      const pusher = getPusherServer()
      await pusher.trigger(
        getConversationChannel(conversationId),
        isTyping ? PUSHER_EVENTS.TYPING_START : PUSHER_EVENTS.TYPING_STOP,
        {
          userId,
          userName: userInfo?.name || "Unknown",
          conversationId,
        }
      )
    } catch (error) {
      console.error("Pusher trigger failed:", error)
    }

    return NextResponse.json({ success: true })
  })
}

export const POST=wrapAdmission(POSTHandler,'src/app/api/v1/conversations/[id]/typing/route.ts'+':POST',3000);
