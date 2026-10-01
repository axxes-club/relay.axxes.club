import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, conversationParticipants } from "@/lib/db/schema"

/** Participation alone never grants access to a different selected workspace. */
export async function assertConversationAccess(id: string, userId: string, tenantId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Conversation not found")
  const rows = await db.select({ id: conversations.id }).from(conversations)
    .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
    .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId),
      isNull(conversations.deletedAt), eq(conversationParticipants.userId, userId),
      isNull(conversationParticipants.leftAt))).limit(1)
  if (!rows.length) throw new Error("Conversation not found or access denied")
}
