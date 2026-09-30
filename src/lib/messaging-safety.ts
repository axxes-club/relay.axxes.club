/** Old reply IDs may predate tenant validation. Never serialize an unrelated reply. */
export function safeReply<T extends { tenantId?: unknown; conversationId?: unknown; deletedAt?: unknown }>(reply: T | T[] | null, tenantId: string, conversationId: string): T | null {
  return reply && !Array.isArray(reply) && reply.tenantId === tenantId && reply.conversationId === conversationId && !reply.deletedAt ? reply : null
}
