import { pgTable, text, uuid, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { tenants } from "./tenants"

// Digital Asset Management
export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Basic info
  name: text("name").notNull(),
  description: text("description"),

  // File info
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"), // bytes
  width: integer("width"), // for images
  height: integer("height"), // for images

  // Organization
  folder: text("folder"), // virtual folder path
  tags: jsonb("tags").$type<string[]>(),
  category: text("category"), // "image", "video", "document", "audio"

  // Source tracking
  source: text("source").default("url"), // "url" | "upload"
  originalFilename: text("original_filename"),

  // Alt text for accessibility/SEO
  altText: text("alt_text"),

  // Usage tracking
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const assetsRelations = relations(assets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [assets.tenantId],
    references: [tenants.id],
  }),
}))

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert


/**
 * Links a Folders file to a record in another AXXES app.
 *
 * Owned by members.axxes.club, mapped here because this app writes links. Every
 * product that sets `folders.appKey` in its product config uses this table, so
 * adding a product to the suite never needs a new table.
 */
export const assetAppLinks = pgTable(
  "asset_app_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    appKey: text("app_key").notNull(),
    recordId: uuid("record_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("asset_app_links_asset_app_idx").on(table.assetId, table.appKey),
    index("asset_app_links_record_idx").on(table.appKey, table.recordId),
  ],
);
