import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { embeddingVector } from "./pg-types";

export const productStatus = pgEnum("product_status", [
  "draft",
  "review",
  "approved",
  "published",
  "archived"
]);
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

export const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
};

export const sizeCharts = pgTable(
  "size_charts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sport: text("sport"),
    description: text("description"),
    rows: jsonb("rows").notNull().default(sql`'[]'::jsonb`),
    notes: text("notes"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("size_charts_slug_idx").on(table.slug),
    sportIdx: index("size_charts_sport_idx").on(table.sport)
  })
);

export const productOptionSets = pgTable(
  "product_option_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    sport: text("sport"),
    sizes: jsonb("sizes").notNull().default(sql`'[]'::jsonb`),
    source: text("source").notNull().default("aris-sjd"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("product_option_sets_slug_idx").on(table.slug)
  })
);

export const customisationProfiles = pgTable(
  "customisation_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    allowedModes: text("allowed_modes")
      .array()
      .notNull()
      .default(sql`ARRAY['none', 'name', 'number', 'name_number']::text[]`),
    nameMaxLength: integer("name_max_length").notNull().default(12),
    numberMaxLength: integer("number_max_length").notNull().default(2),
    messageMaxLength: integer("message_max_length").notNull().default(20),
    namePriceAmount: numeric("name_price_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    numberPriceAmount: numeric("number_price_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    nameNumberPriceAmount: numeric("name_number_price_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    messagePriceAmount: numeric("message_price_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currencyCode: text("currency_code").notNull().default("USD"),
    requiresSize: boolean("requires_size").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("customisation_profiles_slug_idx").on(table.slug)
  })
);

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
    playerName: text("player_name"),
    careInstructions: text("care_instructions"),
    shippingExpectations: text("shipping_expectations"),
    faqs: jsonb("faqs").notNull().default(sql`'[]'::jsonb`),
    customisationEnabled: boolean("customisation_enabled").notNull().default(true),
    sizeChartId: uuid("size_chart_id").references(() => sizeCharts.id),
    customisationProfileId: uuid("customisation_profile_id").references(() => customisationProfiles.id),
    optionSetId: uuid("option_set_id").references(() => productOptionSets.id),
    status: productStatus("status").notNull().default("draft"),
    sourcePayload: jsonb("source_payload"),
    embedding: embeddingVector("embedding"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("products_slug_idx").on(table.slug),
    shopifyIdx: uniqueIndex("products_shopify_id_idx")
      .on(table.shopifyId)
      .where(sql`${table.shopifyId} is not null`),
    statusIdx: index("products_status_idx").on(table.status),
    sizeChartIdx: index("products_size_chart_id_idx").on(table.sizeChartId),
    customisationProfileIdx: index("products_customisation_profile_id_idx").on(table.customisationProfileId),
    optionSetIdx: index("products_option_set_id_idx").on(table.optionSetId)
  })
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    shopifyId: text("shopify_id"),
    sku: text("sku"),
    title: text("title").notNull(),
    sizeLabel: text("size_label"),
    priceAmount: numeric("price_amount", { precision: 12, scale: 2 }).notNull(),
    compareAtAmount: numeric("compare_at_amount", { precision: 12, scale: 2 }),
    currencyCode: text("currency_code").notNull().default("USD"),
    inventoryQuantity: integer("inventory_quantity"),
    isAvailable: boolean("is_available").notNull().default(false),
    options: jsonb("options").notNull().default(sql`'{}'::jsonb`),
    ...auditColumns
  },
  (table) => ({
    productIdx: index("product_variants_product_id_idx").on(table.productId),
    skuIdx: index("product_variants_sku_idx").on(table.sku),
    shopifyIdx: uniqueIndex("product_variants_shopify_id_idx")
      .on(table.shopifyId)
      .where(sql`${table.shopifyId} is not null`)
  })
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
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
    sourcePayload: jsonb("source_payload"),
    ...auditColumns
  },
  (table) => ({
    slugIdx: uniqueIndex("collections_slug_idx").on(table.slug),
    shopifyIdx: uniqueIndex("collections_shopify_id_idx")
      .on(table.shopifyId)
      .where(sql`${table.shopifyId} is not null`)
  })
);

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.productId] }),
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

export const migrationRuns = pgTable("migration_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull().default("shopify"),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  lastCheckpoint: jsonb("last_checkpoint"),
  counters: jsonb("counters").notNull().default(sql`'{}'::jsonb`),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const migrationCheckpoints = pgTable(
  "migration_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => migrationRuns.id),
    resource: text("resource").notNull(),
    cursor: text("cursor"),
    completed: boolean("completed").notNull().default(false),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    runResourceIdx: uniqueIndex("migration_checkpoints_run_resource_idx").on(table.runId, table.resource)
  })
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    marketingEmailOptIn: boolean("marketing_email_opt_in").notNull().default(false),
    marketingSmsOptIn: boolean("marketing_sms_opt_in").notNull().default(false),
    notes: text("notes"),
    ...auditColumns
  },
  (table) => ({
    phoneIdx: index("customers_phone_idx").on(table.phone)
  })
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    customerId: uuid("customer_id").references(() => customers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sessionIdx: uniqueIndex("carts_session_id_idx").on(table.sessionId)
  })
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull().default(1),
    customisation: jsonb("customisation").notNull().default(sql`'{"mode":"none"}'::jsonb`),
    customisationFingerprint: text("customisation_fingerprint").notNull().default("none"),
    customisationPriceAmount: numeric("customisation_price_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    selectedOptions: jsonb("selected_options"),
    unitPriceAmount: numeric("unit_price_amount", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    cartVariantCustomisationIdx: uniqueIndex("cart_items_cart_variant_customisation_idx").on(
      table.cartId,
      table.variantId,
      table.customisationFingerprint
    ),
    cartIdx: index("cart_items_cart_id_idx").on(table.cartId),
    variantIdx: index("cart_items_variant_id_idx").on(table.variantId)
  })
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    fromPathActiveIdx: uniqueIndex("redirects_from_path_active_idx")
      .on(table.fromPath)
      .where(sql`${table.isActive} = true`),
    activeIdx: index("redirects_active_idx").on(table.isActive)
  })
);

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems)
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] })
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  variants: many(productVariants),
  images: many(productImages),
  sizeChart: one(sizeCharts, { fields: [products.sizeChartId], references: [sizeCharts.id] }),
  optionSet: one(productOptionSets, {
    fields: [products.optionSetId],
    references: [productOptionSets.id]
  }),
  customisationProfile: one(customisationProfiles, {
    fields: [products.customisationProfileId],
    references: [customisationProfiles.id]
  })
}));

export const migrationRunsRelations = relations(migrationRuns, ({ many }) => ({
  checkpoints: many(migrationCheckpoints)
}));
