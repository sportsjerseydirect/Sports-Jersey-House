import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  cartItems,
  carts,
  collectionProducts,
  collections,
  complianceFlags,
  creativeAssets,
  customers,
  customisationProfiles,
  migrationCheckpoints,
  migrationRuns,
  productImages,
  productVariants,
  products,
  redirects,
  seoRecords,
  sizeCharts
} from "./schema-catalogue";
import {
  abandonedCheckouts,
  aiActionAudits,
  courierRules,
  emailSubscribers,
  issueCases,
  marketingLeads,
  orderItems,
  orders,
  productSupplierMappings,
  purchaseOrderLines,
  purchaseOrders,
  stripeRuntimeConfig,
  stripeWebhookEvents,
  suppliers
} from "./schema-commerce";
import {
  catalogueProposals,
  catalogueReviewQueue,
  contentIpRiskFlags,
  issueCaseEvidence,
  issueCaseEvents,
  marketingOffers,
  opsJobRuns,
  productCatalogueSignals,
  shopifyImportErrors,
  shopifyImportRaw,
  shopifyImportRuns,
  shopifyImportStagedProducts,
  trackingExceptions,
  aiAgentSettings,
  aiAgentCategoryModes,
  aiChangeLog,
  gscPageInsights
} from "./schema-ops";

const databaseClients = new Map<string, ReturnType<typeof drizzle>>();

function resolvePostgresPoolSize(): number {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return 1;
  }

  return 5;
}

export const databaseSchema = {
  products,
  productVariants,
  productImages,
  collections,
  collectionProducts,
  seoRecords,
  complianceFlags,
  creativeAssets,
  migrationRuns,
  migrationCheckpoints,
  carts,
  cartItems,
  redirects,
  customers,
  sizeCharts,
  customisationProfiles,
  suppliers,
  productSupplierMappings,
  orders,
  orderItems,
  purchaseOrders,
  purchaseOrderLines,
  stripeWebhookEvents,
  stripeRuntimeConfig,
  courierRules,
  issueCases,
  marketingLeads,
  emailSubscribers,
  abandonedCheckouts,
  aiActionAudits,
  trackingExceptions,
  issueCaseEvidence,
  issueCaseEvents,
  marketingOffers,
  opsJobRuns,
  productCatalogueSignals,
  catalogueProposals,
  catalogueReviewQueue,
  contentIpRiskFlags,
  shopifyImportRuns,
  shopifyImportRaw,
  shopifyImportStagedProducts,
  shopifyImportErrors,
  aiAgentSettings,
  aiAgentCategoryModes,
  aiChangeLog,
  gscPageInsights
};

export function createDatabaseClient(databaseUrl: string) {
  const cached = databaseClients.get(databaseUrl);

  if (cached) {
    return cached;
  }

  const options: Parameters<typeof postgres>[1] = {
    max: resolvePostgresPoolSize(),
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10
  };

  if (/supabase\.co|sslmode=require/i.test(databaseUrl)) {
    options.ssl = "require";
  }

  const queryClient = postgres(databaseUrl, options);
  const db = drizzle(queryClient, { schema: databaseSchema });

  databaseClients.set(databaseUrl, db);
  return db;
}
