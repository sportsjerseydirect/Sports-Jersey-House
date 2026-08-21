import { z } from "zod";
import {
  customisationProfileSchema,
  productFaqSchema,
  sizeChartSchema
} from "./commerce";

export const productStatusSchema = z.enum([
  "draft",
  "review",
  "approved",
  "published",
  "archived"
]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const approvalStatusSchema = z.enum([
  "draft",
  "ai_generated",
  "under_review",
  "approved",
  "rejected",
  "published",
  "archived"
]);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const marketSchema = z.enum(["US", "CA"]);
export type Market = z.infer<typeof marketSchema>;

export const moneySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{2})?$/),
  currencyCode: z.enum(["USD", "CAD", "GBP"])
});
export type Money = z.infer<typeof moneySchema>;

export const productSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: productStatusSchema,
  vendor: z.string().optional(),
  sport: z.string().optional(),
  league: z.string().optional(),
  team: z.string().optional(),
  primaryImageUrl: z.string().url().optional(),
  price: moneySchema.optional()
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productVariantSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  sku: z.string().optional(),
  sizeLabel: z.string().optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  isAvailable: z.boolean()
});
export type ProductVariantSummary = z.infer<typeof productVariantSummarySchema>;

export const productImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional()
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const productDetailSchema = productSummarySchema.extend({
  playerName: z.string().optional(),
  careInstructions: z.string().optional(),
  shippingExpectations: z.string().optional(),
  faqs: z.array(productFaqSchema).default([]),
  customisationEnabled: z.boolean().default(true),
  sizeChart: sizeChartSchema.optional(),
  customisationProfile: customisationProfileSchema.optional(),
  variants: z.array(productVariantSummarySchema).default([]),
  images: z.array(productImageSchema).default([])
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const collectionSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: productStatusSchema
});
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;

export const collectionDetailSchema = collectionSummarySchema.extend({
  products: z.array(productSummarySchema).default([])
});
export type CollectionDetail = z.infer<typeof collectionDetailSchema>;

export const seoDraftSchema = z.object({
  id: z.string().uuid(),
  targetType: z.enum(["product", "collection", "page"]),
  targetId: z.string().uuid(),
  title: z.string().max(70),
  description: z.string().max(180),
  canonicalPath: z.string().startsWith("/"),
  approvalStatus: approvalStatusSchema,
  riskLevel: riskLevelSchema.default("low")
});
export type SeoDraft = z.infer<typeof seoDraftSchema>;

export const creativeAssetSchema = z.object({
  id: z.string().uuid(),
  assetType: z.enum(["logo", "favicon", "hero", "banner", "collection", "product", "social", "email", "ad"]),
  campaign: z.string().optional(),
  page: z.string().optional(),
  productId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  brief: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(["svg", "png", "jpg", "webp"]),
  status: approvalStatusSchema,
  complianceStatus: approvalStatusSchema,
  version: z.number().int().positive(),
  provenance: z.string().min(1),
  altText: z.string().min(1),
  url: z.string().url().optional()
});
export type CreativeAsset = z.infer<typeof creativeAssetSchema>;

export const featureFlagsSchema = z.object({
  enableAiShoppingAssistant: z.boolean().default(false),
  enableShopifySync: z.boolean().default(false)
});
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export function toBooleanFlag(value: string | undefined): boolean {
  return value === "true";
}

export const migrationResourceSchema = z.enum([
  "products",
  "collections",
  "metafields",
  "metaobjects",
  "redirects"
]);
export type MigrationResource = z.infer<typeof migrationResourceSchema>;

export const migrationCheckpointPayloadSchema = z.object({
  importedCount: z.number().int().nonnegative().default(0)
});
export type MigrationCheckpointPayload = z.infer<typeof migrationCheckpointPayloadSchema>;

export const extractionCheckpointSchema = z.object({
  resource: migrationResourceSchema,
  cursor: z.string().nullable(),
  completed: z.boolean(),
  importedCount: z.number().int().nonnegative()
});
export type ExtractionCheckpoint = z.infer<typeof extractionCheckpointSchema>;

export {
  queueNames,
  createJobEnvelope,
  type QueueName,
  type JobEnvelope
} from "./queues";

export {
  cartCustomisationSchema,
  customisationModeSchema,
  customisationPriceForMode,
  customisationProfileSchema,
  formatCustomisationSummary,
  abandonedCheckoutDraftSchema,
  guestCheckoutSchema,
  shippingAddressSchema,
  fulfilmentStatusSchema,
  issueReasonSchema,
  issueStatusSchema,
  orderStatusSchema,
  productFaqSchema,
  sizeChartRowSchema,
  sizeChartSchema,
  type AbandonedCheckoutDraft,
  type CartCustomisation,
  type CustomisationMode,
  type CustomisationProfile,
  type FulfilmentStatus,
  type GuestCheckoutInput,
  type IssueReason,
  type IssueStatus,
  type OrderStatus,
  type ProductFaq,
  type ShippingAddress,
  type SizeChart,
  type SizeChartRow
} from "./commerce";

export {
  LEAGUE_TO_SPORT,
  buildImageAltText,
  displayCategoryLabel,
  draftMetaDescription,
  evaluateDescriptionQuality,
  inferTaxonomyFromCatalogueText,
  nextCategoryModeAfterDecision,
  sportFromLeague,
  CALIBRATABLE_CATEGORIES,
  HIGH_CONFIDENCE_THRESHOLD,
  isHighConfidenceChange
} from "./catalogue-rules";
export type {
  CatalogueChangeCategory,
  DescriptionDecision,
  InferredTaxonomy
} from "./catalogue-rules";
