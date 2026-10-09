import {wrapAdmission} from '@/lib/security/admission-server';
import { NextRequest, NextResponse } from "next/server"
import { withTenantAccess } from "@/lib/auth/tenant-context"
import { db } from "@/lib/db"
import {
  conversations,
  conversationParticipants,
  tenantMemberships,
} from "@/lib/db/schema"
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm"

// GET /api/v1/conversations - List user's conversations
async function GETHandler(request: NextRequest) {
  return withTenantAccess(request, async (tenantId, userId) => {
    // Get all conversations where user is a participant
    const userConversations = await db
      .select({
        conversation: conversations,
        participant: conversationParticipants,
      })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        eq(conversations.id, conversationParticipants.conversationId)
      )
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          eq(conversationParticipants.userId, userId),
          isNull(conversations.deletedAt),
          isNull(conversationParticipants.leftAt)
        )
      )
      .orderBy(desc(conversations.lastMessageAt))

    // Get participants for each conversation
    const conversationIds = userConversations.map((c) => c.conversation.id)

    const allParticipants = (
      conversationIds.length > 0
        ? await db.query.conversationParticipants.findMany({
            where: and(
              inArray(conversationParticipants.conversationId, conversationIds),
              isNull(conversationParticipants.leftAt)
            ),
            with: {
              user: true,
            },
          })
        : []
      // Drizzle cannot prove the `user` relation is one-to-one from the schema
      // alone and widens it to row-or-array. The join is to a primary key, so it
      // is always a single row; naming it keeps the field access checked.
    ) as unknown as {
      conversationId: string
      userId: string
      isAdmin: boolean | null
      user: { id: string; name: string; email: string; image: string | null } | null
    }[]

    // Group participants by conversation
    const participantsByConversation = allParticipants.reduce(
      (acc, p) => {
        if (!acc[p.conversationId]) acc[p.conversationId] = []
        acc[p.conversationId].push({
          userId: p.userId,
          name: p.user?.name || "Unknown",
          image: p.user?.image ?? null,
          isAdmin: p.isAdmin,
        })
        return acc
      },
      {} as Record<
        string,
        Array<{
          userId: string
          name: string
          image: string | null
          isAdmin: boolean | null
        }>
      >
    )

    const result = userConversations.map((c) => ({
      id: c.conversation.id,
      type: c.conversation.type,
      name: c.conversation.name,
      avatarUrl: c.conversation.avatarUrl,
      lastMessageAt: c.conversation.lastMessageAt,
      lastMessagePreview: c.conversation.lastMessagePreview,
      unreadCount: c.participant.unreadCount,
      isMuted: c.participant.isMuted,
      isPinned: c.participant.isPinned,
      participants: participantsByConversation[c.conversation.id] || [],
      createdAt: c.conversation.createdAt,
    }))

    return NextResponse.json({ success: true, data: result })
  })
}

// POST /api/v1/conversations - Create a new conversation
async function POSTHandler(request: NextRequest) {
  return withTenantAccess(request, async (tenantId, userId) => {
    const body = await request.json()
    const { participantIds, name, type = "direct" } = body

    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Participant IDs required" } },
        { status: 400 }
      )
    }

    // Add current user to participants
    const allParticipantIds = [...new Set([userId, ...participantIds])]

    // Verify all participants are members of the tenant
    const memberships = await db.query.tenantMemberships.findMany({
      where: and(
        eq(tenantMemberships.tenantId, tenantId),
        inArray(tenantMemberships.userId, allParticipantIds),
        isNull(tenantMemberships.deletedAt)
      ),
    })

    if (memberships.length !== allParticipantIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Some participants are not team members" },
        },
        { status: 400 }
      )
    }

    // For direct messages, check if conversation already exists
    if (type === "direct" && allParticipantIds.length === 2) {
      const existingConversation = await findExistingDirectConversation(
        tenantId,
        allParticipantIds[0],
        allParticipantIds[1]
      )

      if (existingConversation) {
        return NextResponse.json({
          success: true,
          data: existingConversation,
          existing: true,
        })
      }
    }


  // Create conversation
    const [conversation] = await db
      .insert(conversations)
      .values({
        tenantId,
        type,
        name: type === "group" ? name : null,
        createdById: userId,
      })
      .returning()

    // Add participants
    await db.insert(conversationParticipants).values(
      allParticipantIds.map((participantId) => ({
        conversationId: conversation.id,
        userId: participantId,
        isAdmin: participantId === userId,
      }))
    )

    return NextResponse.json({ success: true, data: conversation })
  })
}

async function findExistingDirectConversation(
  tenantId: string,
  userId1: string,
  userId2: string
) {
  const result = await db.execute(sql`
    SELECT c.*
    FROM conversations c
    WHERE c.tenant_id = ${tenantId}
      AND c.type = 'direct'
      AND c.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM conversation_participants cp1
        WHERE cp1.conversation_id = c.id
          AND cp1.user_id = ${userId1}
          AND cp1.left_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM conversation_participants cp2
        WHERE cp2.conversation_id = c.id
          AND cp2.user_id = ${userId2}
          AND cp2.left_at IS NULL
      )
      AND (
        SELECT COUNT(*) FROM conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.left_at IS NULL
      ) = 2
    LIMIT 1
  `)

  return result.rows[0] || null
}

export const GET=wrapAdmission(GETHandler,'src/app/api/v1/conversations/route.ts'+':GET',12000);

export const POST=wrapAdmission(POSTHandler,'src/app/api/v1/conversations/route.ts'+':POST',3000);
