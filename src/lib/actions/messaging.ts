"use server"

import { db } from "@/lib/db"
import {
  conversations,
  conversationParticipants,
  messages,
  tenantMemberships,
  user,
} from "@/lib/db/schema"
import { eq, and, desc, sql, inArray, ne, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext } from "@/lib/auth"
import {
  getPusherServer,
  getConversationChannel,
  getUserChannel,
  PUSHER_EVENTS,
} from "@/lib/pusher/server"

const createConversationSchema = z.object({
  participantIds: z
    .array(z.string())
    .min(1, "At least one participant required"),
  name: z.string().optional(),
  type: z.enum(["direct", "group"]).default("direct"),
})

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content required"),
  contentType: z.enum(["text", "image", "file"]).default("text"),
  replyToId: z.string().uuid().optional(),
})

export type CreateConversationData = z.infer<typeof createConversationSchema>
export type SendMessageData = z.infer<typeof sendMessageSchema>

/**
 * A participant row with the joined user.
 *
 * Named rather than inline because Drizzle widens `with: { user: true }` to a
 * union of "row or array of rows" when it cannot prove the relation is a
 * one-to-one. Naming the shape here keeps `p.user.name` checked rather than
 * silently `any`, which is the difference between a rename that compiles and a
 * rename that breaks at runtime.
 *
 * The nulls are real: `is_admin` and `user.image` are `.default()` without
 * `.notNull()`, so the column type is nullable even though the default is not.
 */
type ParticipantWithUser = {
  conversationId: string
  userId: string
  isAdmin: boolean | null
  user: { id: string; name: string; email: string; image: string | null } | null
}

/** A workspace membership with the joined user, for the "new conversation" picker. */
type MembershipWithUser = {
  userId: string
  role: string
  user: { id: string; name: string; email: string; image: string | null } | null
}

// Get all conversations for the current user
export async function getConversations() {
  const { userId, tenantId } = await getAuthContext()

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

  // Get all participants
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
    // See the note in the API route: Drizzle widens a one-to-one `with` to
    // row-or-array, and this join is to a primary key so it is always one row.
  ) as unknown as ParticipantWithUser[]

  const participantsByConversation = allParticipants.reduce(
    (acc, p) => {
      if (!acc[p.conversationId]) acc[p.conversationId] = []
      acc[p.conversationId].push({
        userId: p.userId,
        name: p.user?.name || "Unknown",
        // The column is nullable but the joined row may be absent entirely, so
        // `undefined` is reachable. Coerced rather than widened so the shape the
        // UI consumes is the same one everywhere.
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

  return userConversations.map((c) => ({
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
}

// Get single conversation with messages
export async function getConversation(conversationId: string) {
  const { userId } = await getAuthContext()

  // Verify participation
  const participant = await db.query.conversationParticipants.findFirst({
    where: and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, userId),
      isNull(conversationParticipants.leftAt)
    ),
    with: {
      conversation: {
        with: {
          participants: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!participant) {
    throw new Error("Conversation not found or access denied")
  }

  // The nested `with: { participants: { with: { user: true } } }` widens the
  // participants collection to a row-or-array union, so it is named before use.
  const conversation = participant.conversation as typeof participant.conversation & {
    participants: ParticipantWithUser[]
  }

  return {
    ...conversation,
    unreadCount: participant.unreadCount,
    participants: conversation.participants.map((p) => ({
      userId: p.userId,
      name: p.user?.name || "Unknown",
      image: p.user?.image ?? null,
      isAdmin: p.isAdmin,
    })),
  }
}

// Create a new conversation
export async function createConversation(data: CreateConversationData) {
  const { userId, tenantId } = await getAuthContext()

  const parsed = createConversationSchema.parse(data)
  const allParticipantIds = [...new Set([userId, ...parsed.participantIds])]

  // For direct messages, check if conversation exists
  if (parsed.type === "direct" && allParticipantIds.length === 2) {
    const existing = await findExistingDirectConversation(
      tenantId,
      allParticipantIds[0],
      allParticipantIds[1]
    )
    if (existing) return existing
  }

  // Verify all participants are tenant members
  const memberships = await db.query.tenantMemberships.findMany({
    where: and(
      eq(tenantMemberships.tenantId, tenantId),
      inArray(tenantMemberships.userId, allParticipantIds),
      isNull(tenantMemberships.deletedAt)
    ),
  })

  if (memberships.length !== allParticipantIds.length) {
    throw new Error("Some participants are not team members")
  }

  // Create conversation
  const [conversation] = await db
    .insert(conversations)
    .values({
      tenantId,
      type: parsed.type,
      name: parsed.type === "group" ? parsed.name : null,
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

  revalidatePath("/messages")
  return conversation
}

// Send a message
export async function sendMessage(
  conversationId: string,
  data: SendMessageData
) {
  const { userId, tenantId } = await getAuthContext()

  const parsed = sendMessageSchema.parse(data)

  // Verify participation
  const participant = await db.query.conversationParticipants.findFirst({
    where: and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.userId, userId),
      isNull(conversationParticipants.leftAt)
    ),
  })

  if (!participant) {
    throw new Error("Access denied")
  }

  // Create message
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      tenantId,
      content: parsed.content.trim(),
      contentType: parsed.contentType,
      senderId: userId,
      replyToId: parsed.replyToId,
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
    parsed.content.length > 100
      ? parsed.content.substring(0, 100) + "..."
      : parsed.content

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

  // Get all participants
  const participants = await db.query.conversationParticipants.findMany({
    where: and(
      eq(conversationParticipants.conversationId, conversationId),
      isNull(conversationParticipants.leftAt)
    ),
  })

  // Trigger Pusher events
  try {
    const pusher = getPusherServer()

    await pusher.trigger(
      getConversationChannel(conversationId),
      PUSHER_EVENTS.NEW_MESSAGE,
      messageWithSender
    )

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
    console.error("Pusher trigger failed:", error)
  }

  revalidatePath(`/messages/${conversationId}`)
  return messageWithSender
}

// Mark conversation as read
export async function markAsRead(conversationId: string) {
  const { userId } = await getAuthContext()

  const latestMessage = await db.query.messages.findFirst({
    where: and(
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt)
    ),
    orderBy: desc(messages.createdAt),
  })

  await db
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

  revalidatePath("/messages")
}

// Get total unread count
export async function getTotalUnreadCount() {
  const { userId, tenantId } = await getAuthContext()

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${conversationParticipants.unreadCount}), 0)`,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversationParticipants.conversationId, conversations.id)
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        eq(conversations.tenantId, tenantId),
        isNull(conversationParticipants.leftAt),
        isNull(conversations.deletedAt)
      )
    )

  return Number(result[0]?.total || 0)
}

// Get team members available for messaging
export async function getTeamMembersForMessaging() {
  const { userId, tenantId } = await getAuthContext()

  const memberships = await db.query.tenantMemberships.findMany({
    where: and(
      eq(tenantMemberships.tenantId, tenantId),
      ne(tenantMemberships.userId, userId),
      isNull(tenantMemberships.deletedAt)
    ),
    with: {
      user: true,
    },
  })

  return (memberships as unknown as MembershipWithUser[]).map((m) => ({
    id: m.userId,
    name: m.user?.name || "Unknown",
    email: m.user?.email || "",
    image: m.user?.image ?? null,
    role: m.role,
  }))
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
