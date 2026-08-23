import { drizzle } from "drizzle-orm/postgres-js";

export { fromExtractionCheckpoint, parseMigrationCheckpointPayload, toExtractionCheckpoint } from "./checkpoints";
export { verifyMigration } from "./verify-migration";
export type { MigrationVerificationResult } from "./verify-migration";
export {
  addItemToCart,
  fingerprintCustomisation,
  getCartBySessionId,
  getOrCreateCart,
  removeCartItem,
  updateCartItemQuantity
} from "./cart";
export type { CartCustomisationInput, CartLineItem, CartSnapshot } from "./cart";
export { resolveCartCustomisationPricing } from "./cart-customisation";
export type { ResolvedCartCustomisation } from "./cart-customisation";
export { findActiveRedirect, normalizeRedirectPath } from "./redirects";
export type { RedirectMatch } from "./redirects";
export { createDatabaseClient, databaseSchema } from "./client";
export {
  clearCart,
  createOrderFromCart,
  getOrderByNumber,
  listOrders,
  recordAbandonedCheckout
} from "./orders";
export type { OrderLineSnapshot, OrderSnapshot } from "./orders";
export {
  createPurchaseOrderBatch,
  createSupplier,
  ensureDefaultSupplierMappings,
  getPurchaseOrderByNumber,
  listProductSupplierMappings,
  listPurchaseOrders,
  listSuppliers,
  setSupplierActive,
  updateSupplier,
  upsertProductSupplierMapping
} from "./suppliers";
export type {
  PoBatchResult,
  ProductSupplierMappingSnapshot,
  PurchaseOrderSnapshot,
  SupplierSnapshot
} from "./suppliers";
export {
  buildShippingEmailDraft,
  createCourierRule,
  ingestTrackingPaste,
  listCourierRules,
  listTrackingExceptions,
  matchCourier,
  matchCourierFromRules,
  persistTrackingException,
  resolveTrackingException,
  setCourierRuleActive,
  updateCourierRule
} from "./tracking";
export type {
  CourierRuleSnapshot,
  MatchedCourier,
  TrackingExceptionSnapshot,
  TrackingIngestResult
} from "./tracking";
export {
  applyMappedSupplierCosts,
  computeLineMargin,
  getOrderMargins,
  listRecentOrderMargins,
  updateOrderItemCosts
} from "./margins";
export type { LineMarginSnapshot, OrderMarginSnapshot } from "./margins";
export {
  addIssueEvidence,
  createIssueCase,
  getIssueCaseByNumber,
  listIssueCases,
  listIssueEvidence,
  updateIssueCase
} from "./issues";
export type { IssueCaseSnapshot, IssueEvidenceSnapshot } from "./issues";
export {
  confirmOpsAction,
  createOpsAuditPreview,
  listAiActionAudits,
  rejectOpsAction
} from "./ai-ops";
export type { AiActionAuditSnapshot } from "./ai-ops";
export {
  buildAbandonedCheckoutEmailDraft,
  captureMarketingLead,
  listAbandonedCheckouts,
  listEmailSubscribers,
  listMarketingLeads
} from "./marketing";
export type {
  AbandonedCheckoutSnapshot,
  EmailSubscriberSnapshot,
  MarketingLeadSnapshot
} from "./marketing";

export {
  finishOpsJobRun,
  listOpsJobRuns,
  runDailyPoBatchJob,
  runMarginCostRefreshJob,
  runOpsExceptionDetectionJob,
  runSupplierTrackingRequestJob,
  runTrackingIngestCheckJob,
  startOpsJobRun
} from "./ops-jobs";
export type { OpsJobRunSnapshot, OpsJobType } from "./ops-jobs";
export {
  applyOfferToAmounts,
  computeDiscountForSubtotal,
  evaluateWelcome10Eligibility,
  getOfferByCode
} from "./offers";
export type { MarketingOfferSnapshot, Welcome10Eligibility } from "./offers";
export {
  computeProductSignals,
  createCatalogueProposal,
  flagContentIpRisk,
  listCatalogueProposals,
  listReviewQueue,
  reviewCatalogueProposal
} from "./catalogue-intelligence";
export type {
  CatalogueProposalSnapshot,
  CatalogueRecommendation,
  CatalogueReviewQueueSnapshot,
  ProductSignalSnapshot
} from "./catalogue-intelligence";
export {
  buildImportReport,
  createImportRun,
  finishImportRun,
  getImportRun,
  getShopifyConnectionHealth,
  listImportRuns,
  stageNormalizedProduct
} from "./shopify-import";
export type {
  ShopifyConnectionHealth,
  ShopifyImportReport,
  ShopifyImportRunSnapshot,
  StagedProductResult
} from "./shopify-import";
export {
  calibrateAndApplyPendingChanges,
  decideAiChange,
  getAiAgentStatus,
  listPendingAiChanges,
  listRecentAiChanges,
  runSimplifiedCatalogueAgent,
  setAiAgentAutonomousEnabled,
  isCategoryAutonomous
} from "./catalogue-agent";
export type {
  AiAgentStatusSnapshot,
  AiCategoryModeSnapshot,
  AiChangeLogSnapshot,
  CalibrationApplyResult,
  CatalogueAgentRunResult
} from "./catalogue-agent";
export {
  getCatalogueHealthStats,
  listLowHealthProducts
} from "./catalogue-health";
export type { CatalogueHealthStats } from "./catalogue-health";
export { getAdminOpsStats } from "./admin-ops-stats";
export type { AdminOpsStats } from "./admin-ops-stats";
export {
  bootstrapSupplierUser,
  getSupplierPurchaseOrderDetail,
  getSupplierUserByEmail,
  hashSupplierPassword,
  listSupplierPurchaseOrders,
  supplierAcknowledgePo,
  supplierSubmitCost,
  supplierSubmitTracking,
  verifySupplierLogin
} from "./supplier-portal";
export type { SupplierPoDetail, SupplierPoLineView, SupplierPoSummary } from "./supplier-portal";
export {
  assertWorkflowTransition,
  ensureSeoRecordForProduct,
  evaluateProductReadiness,
  listCatalogueProductsForAdmin,
  transitionProductStatus
} from "./product-workflow";
export type {
  CatalogueProductListItem,
  ProductReadiness,
  ProductWorkflowAction,
  ReadinessCheck,
  ReadinessSeverity
} from "./product-workflow";
export {
  approvalStatus,
  auditColumns,
  cartItems,
  cartItemsRelations,
  carts,
  cartsRelations,
  collectionProducts,
  collections,
  complianceFlags,
  creativeAssets,
  customers,
  customisationProfiles,
  market,
  migrationCheckpoints,
  migrationRuns,
  migrationRunsRelations,
  productImages,
  productStatus,
  productVariants,
  products,
  productsRelations,
  redirects,
  riskLevel,
  seoRecords,
  sizeCharts
} from "./schema-catalogue";

export {
  abandonedCheckouts,
  aiActionAudits,
  aiActionStatus,
  courierRules,
  customisationMode,
  emailSubscribers,
  fulfilmentStatus,
  issueCases,
  issueReason,
  issueStatus,
  leadCaptureSource,
  marketingLeads,
  orderItems,
  orderItemsRelations,
  orderStatus,
  orders,
  ordersRelations,
  productSupplierMappings,
  purchaseOrderLines,
  purchaseOrderStatus,
  purchaseOrders,
  suppliers
} from "./schema-commerce";

import { cartItems, carts, migrationCheckpoints, migrationRuns, productVariants, products, redirects, customers, sizeCharts, customisationProfiles } from "./schema-catalogue";
import { issueCases, orderItems, orders, purchaseOrders, suppliers } from "./schema-commerce";

export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type MigrationRun = typeof migrationRuns.$inferSelect;
export type MigrationCheckpoint = typeof migrationCheckpoints.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type IssueCase = typeof issueCases.$inferSelect;
export type SizeChart = typeof sizeCharts.$inferSelect;
export type CustomisationProfile = typeof customisationProfiles.$inferSelect;

// Keep drizzle type available for callers that previously inferred via createDatabaseClient.
export type DatabaseClient = ReturnType<typeof drizzle>;
