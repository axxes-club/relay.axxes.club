import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getContext, requireContext } from "@/lib/context"
import { assertConversationAccess } from "@/lib/messaging-access"

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: { message } }, { status })
}

export async function withTenantAccess(
  request: NextRequest,
  handler: (tenantId: string, userId: string) => Promise<NextResponse<unknown>>,
): Promise<NextResponse<unknown>> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return errorResponse("Unauthorized", 401)
  const hint = request.nextUrl.searchParams.get("tenantId")
  const ctx = await getContext(hint || undefined)
  if (!ctx) return errorResponse("Access denied to this organization", 403)
  const match = request.nextUrl.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\//)
  if (match) {
    try { await assertConversationAccess(match[1], ctx.userId, ctx.tenant.id) }
    catch { return errorResponse("Conversation not found or access denied", 403) }
  }
  return handler(ctx.tenant.id, ctx.userId)
}

export async function withResourceAccess(
  request: NextRequest, _resourceTable: string, _resourceId: string,
  handler: (tenantId: string, userId: string) => Promise<NextResponse<unknown>>,
) { return withTenantAccess(request, handler) }

export async function requireTenantAccess() {
  const ctx = await requireContext()
  return { tenantId: ctx.tenant.id, userId: ctx.userId, tenant: ctx.tenant, role: ctx.role }
}
