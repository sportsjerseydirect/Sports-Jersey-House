import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const productStatus = pgEnum("product_status", ["draft", "review", "published", "archived"]);
export const approvalStatus = pgEnum("approval_status", [
  "draft",
  "ai_generated",
  "under_review",
  "approved",
  "rejected",
  "published",
  "archived"
]);
export const riskLevel = pgEnum("risk_level", ["low", "medium", "high", "critical"]);
export const market = pgEnum("market", ["US", "CA"]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
};

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopifyId: text("shopify_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    vendor: text("vendor"),
    productType: text("product_type"),
    sport: text("sport"),
    league: text("league"),
    team: text("team"),
    status: productStatus("status").notNull().default("draft"),
    sourcePayload: jsonb("source_payload"),
    searchVector: text("search_vector"),
    embedding: text("embedding"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("products_slug_idx").on(table.slug),
    shopifyIdx: uniqueIndex("products_shopify_id_idx").on(table.shopifyId),
    statusIdx: index("products_status_idx").on(table.status)
  })
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id),
    shopifyId: text("shopify_id"),
    sku: text("sku"),
    title: text("title").notNull(),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    inventoryQuantity: integer("inventory_quantity"),
    isAvailable: boolean("is_available").notNull().default(false),
    options: jsonb("options").notNull().default(sql`'{}'::jsonb`),
    ...auditColumns
  },
  (table) => ({
    productIdx: index("product_variants_product_id_idx").on(table.productId),
    skuIdx: index("product_variants_sku_idx").on(table.sku)
  })
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id),
    url: text("url").notNull(),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceUrl: text("source_url"),
    ...auditColumns
  },
  (table) => ({
    productIdx: index("product_images_product_id_idx").on(table.productId)
  })
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopifyId: text("shopify_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: productStatus("status").notNull().default("draft"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("collections_slug_idx").on(table.slug)
  })
);

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id").notNull().references(() => collections.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    collectionIdx: index("collection_products_collection_id_idx").on(table.collectionId),
    productIdx: index("collection_products_product_id_idx").on(table.productId)
  })
);

export const seoRecords = pgTable(
  "seo_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    title: text("title"),
    metaDescription: text("meta_description"),
    canonicalPath: text("canonical_path"),
    structuredData: jsonb("structured_data"),
    aiTitle: text("ai_title"),
    aiMetaDescription: text("ai_meta_description"),
    approvalStatus: approvalStatus("approval_status").notNull().default("draft"),
    ...auditColumns
  },
  (table) => ({
    targetIdx: uniqueIndex("seo_records_target_idx").on(table.targetType, table.targetId)
  })
);

export const complianceFlags = pgTable(
  "compliance_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    riskLevel: riskLevel("risk_level").notNull(),
    reason: text("reason").notNull(),
    recommendation: text("recommendation"),
    approvalStatus: approvalStatus("approval_status").notNull().default("under_review"),
    ...auditColumns
  },
  (table) => ({
    targetIdx: index("compliance_flags_target_idx").on(table.targetType, table.targetId)
  })
);

export const creativeAssets = pgTable(
  "creative_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetType: text("asset_type").notNull(),
    campaign: text("campaign"),
    page: text("page"),
    productId: uuid("product_id"),
    collectionId: uuid("collection_id"),
    brief: text("brief").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    format: text("format").notNull(),
    status: approvalStatus("status").notNull().default("draft"),
    complianceStatus: approvalStatus("compliance_status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    provenance: text("provenance").notNull(),
    altText: text("alt_text").notNull(),
    url: text("url"),
    ...auditColumns
  },
  (table) => ({
    statusIdx: index("creative_assets_status_idx").on(table.status)
  })
);

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  images: many(productImages)
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
