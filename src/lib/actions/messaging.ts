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
import { assertConversationAccess } from "@/lib/messaging-access"
import { REACTIONS } from "@/lib/chat/reactions"
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
  lastReadAt: Date | null
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
  const { userId, tenantId } = await getAuthContext()
  await assertConversationAccess(conversationId, userId, tenantId)

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
  const conversation = participant.conversation as unknown as typeof conversations.$inferSelect & {
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
      lastReadAt: p.lastReadAt,
    })),
    isMuted: participant.isMuted,
    isPinned: participant.isPinned,
    selfId: userId,
  }
}

// Create a new conversation
export async function createConversation(data: CreateConversationData) {
  const { userId, tenantId } = await getAuthContext()

  const parsed = createConversationSchema.parse(data)
  const allParticipantIds = [...new Set([userId, ...parsed.participantIds])]

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

  // For direct messages, check if conversation exists
  if (parsed.type === "direct" && allParticipantIds.length === 2) {
    const existing = await findExistingDirectConversation(
      tenantId,
      allParticipantIds[0],
      allParticipantIds[1]
    )
    if (existing) return existing
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

  revalidatePath("/inbox")
  return conversation
}

// Send a message
export async function sendMessage(
  conversationId: string,
  data: SendMessageData
) {
  const { userId, tenantId } = await getAuthContext()

  await assertConversationAccess(conversationId, userId, tenantId)
  const parsed = sendMessageSchema.parse(data)
  if (parsed.replyToId) {
    const reply = await db.query.messages.findFirst({ where: and(eq(messages.id, parsed.replyToId), eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId), isNull(messages.deletedAt)) })
    if (!reply) throw new Error("Reply message not found")
  }

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

  const conversationName =
    (await db.query.conversations.findFirst({ where: eq(conversations.id, conversationId), columns: { name: true } }))?.name ?? null

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
            // Enough for a notification without another round trip.
            preview: preview,
            senderName: sender?.name ?? "Someone",
            conversationName,
            sentAt: message.createdAt,
          }
        )
      }
    }
  } catch (error) {
    console.error("Pusher trigger failed:", error)
  }

  revalidatePath(`/inbox/${conversationId}`)
  return messageWithSender
}

// Mark conversation as read
export async function markAsRead(conversationId: string) {
  const { userId, tenantId } = await getAuthContext()
  await assertConversationAccess(conversationId, userId, tenantId)

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

  revalidatePath("/inbox")
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


// ── Relay: inbox, reactions, edits, deletes, pin & mute ──────────────────────

/** The signed-in person, for rendering "you" without waiting on the client session. */
export async function getMe() {
  const { userId } = await getAuthContext()
  const me = await db.query.user.findFirst({ where: eq(user.id, userId) })
  return { id: userId, name: me?.name ?? "You", image: me?.image ?? null }
}

/**
 * Everything the inbox needs in one round trip. Direct conversations are titled
 * by the *other* person here, on the server, so the first paint never shows
 * your own name on a DM.
 */
export async function getInboxData() {
  const [me, list] = await Promise.all([getMe(), getConversations()])
  return {
    me,
    conversations: list.map((c) => {
      const others = c.participants.filter((p) => p.userId !== me.id)
      const title =
        c.type === "group"
          ? c.name || others.map((p) => p.name.split(" ")[0]).join(", ") || "Group"
          : others[0]?.name || "Just you"
      return { ...c, title, others }
    }),
  }
}

type MessageMeta = { reactions?: Record<string, string[]> } & Record<string, unknown>

async function ownMessage(messageId: string, mustBeSender: boolean) {
  const { userId, tenantId } = await getAuthContext()
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) throw new Error("Message not found")
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.tenantId, tenantId), isNull(messages.deletedAt)),
  })
  if (!message) throw new Error("Message not found")
  await assertConversationAccess(message.conversationId, userId, tenantId)
  if (mustBeSender && message.senderId !== userId) throw new Error("You can only change your own messages")
  return { message, userId, tenantId }
}

async function broadcast(conversationId: string, event: string, payload: unknown) {
  try {
    await getPusherServer().trigger(getConversationChannel(conversationId), event, payload)
  } catch (error) {
    console.error("Pusher trigger failed:", error)
  }
}

/** Adds the reaction if you haven't, removes it if you have. */
export async function toggleReaction(messageId: string, emoji: string) {
  if (!(REACTIONS as readonly string[]).includes(emoji)) throw new Error("Unsupported reaction")
  const { message, userId } = await ownMessage(messageId, false)
  const meta = { ...((message.metadata ?? {}) as MessageMeta) }
  const reactions = { ...(meta.reactions ?? {}) }
  const people = new Set(reactions[emoji] ?? [])
  if (people.has(userId)) people.delete(userId)
  else people.add(userId)
  if (people.size) reactions[emoji] = [...people]
  else delete reactions[emoji]
  meta.reactions = reactions
  await db.update(messages).set({ metadata: meta, updatedAt: new Date() }).where(eq(messages.id, messageId))
  const update = { id: messageId, metadata: meta }
  await broadcast(message.conversationId, PUSHER_EVENTS.MESSAGE_UPDATED, update)
  return update
}

async function refreshPreview(conversationId: string) {
  const latest = await db.query.messages.findFirst({
    where: and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)),
    orderBy: desc(messages.createdAt),
  })
  await db
    .update(conversations)
    .set({
      lastMessagePreview: latest ? (latest.content.length > 100 ? latest.content.slice(0, 100) + "..." : latest.content) : null,
      lastMessageAt: latest?.createdAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId))
}

/** Edits your own message. The change is marked "edited" for everyone. */
export async function editMessage(messageId: string, content: string) {
  const text = z.string().trim().min(1, "Message can't be empty").max(10000).parse(content)
  const { message } = await ownMessage(messageId, true)
  const editedAt = new Date()
  await db.update(messages).set({ content: text, isEdited: true, editedAt, updatedAt: editedAt }).where(eq(messages.id, messageId))
  await refreshPreview(message.conversationId)
  const update = { id: messageId, content: text, isEdited: true, editedAt }
  await broadcast(message.conversationId, PUSHER_EVENTS.MESSAGE_UPDATED, update)
  return update
}

/** Removes your own message for everyone. The row is kept (soft delete). */
export async function deleteMessage(messageId: string) {
  const { message } = await ownMessage(messageId, true)
  await db.update(messages).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(messages.id, messageId))
  await refreshPreview(message.conversationId)
  await broadcast(message.conversationId, PUSHER_EVENTS.MESSAGE_DELETED, { id: messageId })
  return { id: messageId }
}

async function setParticipantFlag(conversationId: string, patch: { isPinned?: boolean; isMuted?: boolean }) {
  const { userId, tenantId } = await getAuthContext()
  await assertConversationAccess(conversationId, userId, tenantId)
  await db
    .update(conversationParticipants)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)))
  revalidatePath("/inbox")
  return { conversationId, ...patch }
}

/** Pins a conversation to the top of your inbox (just for you). */
export async function setPinned(conversationId: string, isPinned: boolean) {
  return setParticipantFlag(conversationId, { isPinned })
}

/** Mutes a conversation's notifications (just for you). */
export async function setMuted(conversationId: string, isMuted: boolean) {
  return setParticipantFlag(conversationId, { isMuted })
}
