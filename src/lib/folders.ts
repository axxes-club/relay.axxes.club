import "server-only"
import { and, eq } from "drizzle-orm"
import { db, schema } from "@/lib/db"
import { getContext } from "@/lib/context"

/**
 * Where this product lives, and how to point at one of its records.
 *
 * AXXES Folders holds `asset_app_links` and cannot join onto tables it does not
 * own, so it asks the rest of the suite to describe itself. An app that adds this
 * to its product config gets "Open in <app>" in every folder, and a "send to
 * Folders" action, without touching any other repository.
 *
 * Set `appKey` to the product's catalog key. It must match the `key` column in
 * `axxes_product`, or the row will be created but nothing will resolve it.
 */
export type AppConfig = {
  /**
   * Catalog key. Omit to skip Folders integration entirely — a product with
   * nothing a person would open from a file does not need an entry.
   */
  appKey?: string
  /** A record, e.g. /boards/<id>. */
  recordHref?: (recordId: string) => string
  /** A read-only view of a record, if the product has one. */
  quickLookHref?: (recordId: string) => string
  /**
   * A path that opens a file from Folders even with no record yet, because the
   * product creates one on first use. This is what makes "Open in …" appear on
   * every file rather than only on files somebody linked in advance.
   */
  openAssetHref?: (assetId: string) => string
}

/** The Folders app, which is where these links are resolved. */
const FOLDERS_URL = "https://folders.axxes.club"

function withTenant(path: string, tenantId?: string | null) {
  return tenantId ? `${path}${path.includes("?") ? "&" : "?"}tenant=${tenantId}` : path
}

/**
 * Links a Folders file to one of this product's records.
 *
 * The asset is checked against the caller's workspace first. The id arrives
 * from a link, and a link is not permission.
 */
export async function linkAssetToRecord(
  config: AppConfig,
  assetId: string,
  recordId: string,
  tenantHint?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!config.appKey) return { ok: false, error: "This product is not linked to Folders" }
  const uuid = /^[0-9a-f-]{36}$/i
  if (!uuid.test(assetId) || !uuid.test(recordId)) return { ok: false, error: "Bad link" }

  const ctx = await getContext(tenantHint)
  if (!ctx) return { ok: false, error: "Sign in to continue" }

  const [asset] = await db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, assetId), eq(schema.assets.tenantId, ctx.tenant.id)))
    .limit(1)
  if (!asset) return { ok: false, error: "That file is not in this workspace" }

  // One record per product per file: re-linking replaces rather than stacks.
  await db
    .insert(schema.assetAppLinks)
    .values({ tenantId: ctx.tenant.id, assetId, appKey: config.appKey, recordId })
    .onConflictDoUpdate({
      target: [schema.assetAppLinks.assetId, schema.assetAppLinks.appKey],
      set: { recordId, createdAt: new Date() },
    })
  return { ok: true }
}

/** Removes this product's link to a file, leaving any other app's alone. */
export async function unlinkAsset(config: AppConfig, assetId: string, tenantHint?: string) {
  if (!config.appKey || !/^[0-9a-f-]{36}$/i.test(assetId)) {
    return { ok: false as const, error: "Bad link" }
  }
  const ctx = await getContext(tenantHint)
  if (!ctx) return { ok: false as const, error: "Sign in to continue" }
  await db
    .delete(schema.assetAppLinks)
    .where(
      and(
        eq(schema.assetAppLinks.tenantId, ctx.tenant.id),
        eq(schema.assetAppLinks.appKey, config.appKey),
        eq(schema.assetAppLinks.assetId, assetId),
      ),
    )
  return { ok: true as const }
}

/** The Folders file a record is attached to, so the product can show it. */
export async function assetForRecord(config: AppConfig, recordId: string, tenantHint?: string) {
  if (!config.appKey || !/^[0-9a-f-]{36}$/i.test(recordId)) return null
  const ctx = await getContext(tenantHint)
  if (!ctx) return null
  const [row] = await db
    .select({ assetId: schema.assetAppLinks.assetId })
    .from(schema.assetAppLinks)
    .where(
      and(
        eq(schema.assetAppLinks.tenantId, ctx.tenant.id),
        eq(schema.assetAppLinks.appKey, config.appKey),
        eq(schema.assetAppLinks.recordId, recordId),
      ),
    )
    .limit(1)
  return row?.assetId ?? null
}

/** A link into Folders at a file, for an action in this product's UI. */
export function foldersHref(assetId: string, tenantId?: string | null) {
  return withTenant(`${FOLDERS_URL}/?asset=${encodeURIComponent(assetId)}`, tenantId)
}
