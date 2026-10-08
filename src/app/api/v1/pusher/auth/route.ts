import {wrapAdmission} from '@/lib/security/admission-server';
import { NextRequest, NextResponse } from "next/server"
import { withTenantAccess } from "@/lib/auth/tenant-context"
import { assertConversationAccess } from "@/lib/messaging-access"
import { getPusherServer } from "@/lib/pusher/server"

async function POSTHandler(request: NextRequest) {
  return withTenantAccess(request, async (tenantId, userId) => {
    const form = await request.formData()
    const socketId = String(form.get("socket_id") || "")
    const channel = String(form.get("channel_name") || "")
    if (!/^\d+\.\d+$/.test(socketId)) return NextResponse.json({ error: "Invalid socket" }, { status: 400 })
    if (channel.startsWith("private-conversation-")) {
      try { await assertConversationAccess(channel.slice("private-conversation-".length), userId, tenantId) }
      catch { return NextResponse.json({ error: "Access denied" }, { status: 403 }) }
    } else if (channel !== `private-user-${userId}`) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    try { return NextResponse.json(getPusherServer().authorizeChannel(socketId, channel)) }
    catch { return NextResponse.json({ error: "Realtime unavailable" }, { status: 503 }) }
  })
}

export const POST=wrapAdmission(POSTHandler,'src/app/api/v1/pusher/auth/route.ts'+':POST',3000);
