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
  listPurchaseOrders,
  listSuppliers
} from "./suppliers";
export type { PoBatchResult, PurchaseOrderSnapshot, SupplierSnapshot } from "./suppliers";
export {
  buildShippingEmailDraft,
  createCourierRule,
  ingestTrackingPaste,
  listCourierRules,
  matchCourier,
  matchCourierFromRules
} from "./tracking";
export type {
  CourierRuleSnapshot,
  MatchedCourier,
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
  createIssueCase,
  getIssueCaseByNumber,
  listIssueCases,
  updateIssueCase
} from "./issues";
export type { IssueCaseSnapshot } from "./issues";
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
