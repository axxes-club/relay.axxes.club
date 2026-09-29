import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { tenantMemberships } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"

interface ApiErrorResponse {
  success: false
  error: { message: string }
}

function errorResponse(message: string, status: number): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error: { message } },
    { status }
  )
}

async function getSession() {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
  return auth.api.getSession({
    headers: new Headers({
      cookie: cookieHeader,
    }),
  })
}

export async function withTenantAccess(
  request: NextRequest,
  handler: (tenantId: string, userId: string) => Promise<NextResponse<unknown>>
): Promise<NextResponse<unknown>> {
  const session = await getSession()

  if (!session?.user) {
    return errorResponse("Unauthorized", 401)
  }

  const userId = session.user.id

  // Get tenant from cookie or query param
  const tenantId =
    request.cookies.get("tenant_id")?.value ||
    request.nextUrl.searchParams.get("tenantId")

  if (!tenantId) {
    return errorResponse("Tenant ID required", 400)
  }

  // Validate membership
  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.userId, userId),
      eq(tenantMemberships.tenantId, tenantId)
    ),
  })

  if (!membership) {
    return errorResponse("Access denied to this tenant", 403)
  }

  return handler(tenantId, userId)
}

export async function withResourceAccess(
  request: NextRequest,
  _resourceTable: string,
  _resourceId: string,
  handler: (tenantId: string, userId: string) => Promise<NextResponse<unknown>>
): Promise<NextResponse<unknown>> {
  return withTenantAccess(request, handler)
}

// For server components and server actions
export async function requireTenantAccess() {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
  const session = await auth.api.getSession({
    headers: new Headers({
      cookie: cookieHeader,
    }),
  })

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const tenantId = cookieStore.get("tenant_id")?.value

  if (!tenantId) {
    throw new Error("No tenant selected")
  }

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.userId, userId),
      eq(tenantMemberships.tenantId, tenantId)
    ),
    with: {
      tenant: true,
    },
  })

  if (!membership) {
    throw new Error("Access denied")
  }

  return {
    tenantId,
    userId,
    tenant: membership.tenant,
    role: membership.role,
  }
}
