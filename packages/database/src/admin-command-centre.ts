import { and, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { getAdminOpsStats } from "./admin-ops-stats";
import { getCatalogueHealthStats, getPublishReadinessStats } from "./catalogue-health";
import { aiActionAudits, issueCases, suppliers } from "./schema-commerce";
import { catalogueProposals } from "./schema-ops";

export type MetricValue = number | null;

export type AdminCommandCentreStats = {
  actionRequired: {
    ordersNeedingAttention: number;
    trackingOverdue: number;
    deliveryOverdue: number;
    supplierIssues: number;
    customerIssues: number;
    replacementCases: number;
    chargebackRisk: MetricValue;
    lowMarginOrders: MetricValue;
  };
  commerce: {
    totalOrders: number;
    distinctCustomers: MetricValue;
    abandonedCheckouts: number;
    paidRevenue: string | null;
    ordersWithMarginData: number;
  };
  fulfilment: {
    purchaseOrders: number;
    awaitingAcknowledgement: number;
    openTrackingExceptions: number;
    activeSuppliers: number;
  };
  catalogue: {
    totalProducts: number;
    published: number;
    draft: number;
    readyToPublish: number;
    needsReview: number;
    blocked: number;
    createNewListingProposals: number;
    seoIssues: number;
  };
  marketing: {
    leads: number;
    activeSubscribers: MetricValue;
    abandonedCheckouts: number;
    welcome10Leads: MetricValue;
  };
  backgroundAutomation: {
    running: number;
    completedToday: number;
    failed: number;
    needsAttention: number;
  };
  ai: {
    pendingHumanDecisions: number;
    recentAudits: number;
  };
};

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

export async function getAdminCommandCentreStats(
  databaseUrl?: string
): Promise<AdminCommandCentreStats> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);

  const [ops, health, readiness] = await Promise.all([
    getAdminOpsStats(url),
    getCatalogueHealthStats(url),
    getPublishReadinessStats(url)
  ]);

  const [
    issueStats,
    commerceStats,
    supplierCount,
    marketingStats,
    automationStats,
    aiStats,
    createNewListingCount,
    riskStats
  ] = await Promise.all([
    db
      .select({
        openCustomerIssues: sql<number>`count(*) filter (where ${issueCases.status} in ('open','investigating','awaiting_customer','awaiting_supplier'))::int`,
        replacementCases: sql<number>`count(*) filter (where ${issueCases.replacementOrderId} is not null or ${issueCases.reason} = 'goodwill_replacement')::int`
      })
      .from(issueCases)
      .where(isNull(issueCases.deletedAt)),

    db.execute<{
      orders_needing_attention: number;
      distinct_customers: number;
      abandoned_checkouts: number;
      paid_revenue: string | null;
      orders_with_margin_data: number;
      low_margin_orders: number;
    }>(sql`
      select
        (
          select count(*)::int from orders o
          where o.deleted_at is null
            and (
              o.status in ('pending_payment','issue')
              or (o.status in ('paid','processing') and o.fulfilment_status = 'unfulfilled')
            )
        ) as orders_needing_attention,
        (
          select count(distinct lower(trim(o.email)))::int from orders o
          where o.deleted_at is null and o.email is not null and trim(o.email) <> ''
        ) as distinct_customers,
        (select count(*)::int from abandoned_checkouts) as abandoned_checkouts,
        (
          select coalesce(sum(o.total_amount::numeric), 0)::text from orders o
          where o.deleted_at is null
            and o.status in ('paid','processing','submitted_to_supplier','partially_shipped','shipped','delivered')
        ) as paid_revenue,
        (
          select count(distinct o.id)::int
          from orders o
          inner join order_items oi on oi.order_id = o.id
          where o.deleted_at is null
            and coalesce(oi.supplier_cost_amount, '') <> ''
        ) as orders_with_margin_data,
        (
          select count(distinct o.id)::int
          from orders o
          inner join order_items oi on oi.order_id = o.id
          where o.deleted_at is null
            and oi.supplier_cost_amount is not null
            and (
              (
                coalesce(oi.unit_price_amount::numeric, 0) * oi.quantity
                + coalesce(oi.customisation_price_amount::numeric, 0) * oi.quantity
                - coalesce(oi.discount_amount::numeric, 0)
              ) > 0
              and (
                (
                  coalesce(oi.unit_price_amount::numeric, 0) * oi.quantity
                  + coalesce(oi.customisation_price_amount::numeric, 0) * oi.quantity
                  - coalesce(oi.discount_amount::numeric, 0)
                  - coalesce(oi.supplier_cost_amount::numeric, 0)
                  - coalesce(oi.fulfilment_cost_amount::numeric, 0)
                  - coalesce(oi.customisation_cost_amount::numeric, 0)
                  - coalesce(oi.other_cost_amount::numeric, 0)
                )
                / nullif(
                  coalesce(oi.unit_price_amount::numeric, 0) * oi.quantity
                  + coalesce(oi.customisation_price_amount::numeric, 0) * oi.quantity
                  - coalesce(oi.discount_amount::numeric, 0),
                  0
                )
              ) < 0.20
            )
        ) as low_margin_orders
    `),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(suppliers)
      .where(and(isNull(suppliers.deletedAt), eq(suppliers.isActive, true))),

    db.execute<{
      leads: number;
      welcome10_leads: number;
      active_subscribers: number;
    }>(sql`
      select
        (select count(*)::int from marketing_leads) as leads,
        (
          select count(*)::int from marketing_leads
          where offer_code = 'WELCOME10'
        ) as welcome10_leads,
        (
          select count(*)::int from email_subscribers
          where is_active = true
        ) as active_subscribers
    `),

    db.execute<{
      running: number;
      completed_today: number;
      failed: number;
      needs_attention: number;
    }>(sql`
      with combined as (
        select status, created_at, finished_at, 'ops' as source
        from ops_job_runs
        union all
        select status, created_at, finished_at, 'import' as source
        from shopify_import_runs
      )
      select
        count(*) filter (where status = 'running')::int as running,
        count(*) filter (
          where status in ('succeeded','completed')
            and coalesce(finished_at, created_at) >= date_trunc('day', now())
        )::int as completed_today,
        count(*) filter (
          where status in ('failed','cancelled')
            and coalesce(finished_at, created_at) >= date_trunc('day', now())
        )::int as failed,
        count(*) filter (
          where status in ('failed','running')
            and created_at < now() - interval '2 hours'
        )::int as needs_attention
      from combined
    `),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(aiActionAudits)
      .where(sql`${aiActionAudits.createdAt} >= now() - interval '7 days'`),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(catalogueProposals)
      .where(
        and(
          isNull(catalogueProposals.deletedAt),
          eq(catalogueProposals.recommendation, "CREATE_NEW_LISTING"),
          eq(catalogueProposals.status, "pending_review")
        )
      ),

    db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from order_risk_scores
      where risk_band in ('medium', 'high')
    `).catch(() => [{ n: 0 }])
  ]);

  const commerceRow = Array.isArray(commerceStats) ? commerceStats[0] : commerceStats;
  const marketingRow = Array.isArray(marketingStats) ? marketingStats[0] : marketingStats;
  const automationRow = Array.isArray(automationStats) ? automationStats[0] : automationStats;
  const riskRow = Array.isArray(riskStats) ? riskStats[0] : riskStats;

  const supplierIssues =
    ops.purchaseOrders.awaitingAcknowledgement + ops.exceptions.openTrackingExceptions;

  return {
    actionRequired: {
      ordersNeedingAttention: commerceRow?.orders_needing_attention ?? 0,
      trackingOverdue: ops.purchaseOrders.trackingOverdue,
      deliveryOverdue: ops.purchaseOrders.deliveryOverdue,
      supplierIssues,
      customerIssues: issueStats[0]?.openCustomerIssues ?? 0,
      replacementCases: issueStats[0]?.replacementCases ?? 0,
      chargebackRisk: riskRow?.n ?? 0,
      lowMarginOrders: commerceRow?.low_margin_orders ?? null
    },
    commerce: {
      totalOrders: ops.orders.total,
      distinctCustomers: commerceRow?.distinct_customers ?? null,
      abandonedCheckouts: commerceRow?.abandoned_checkouts ?? 0,
      paidRevenue: commerceRow?.paid_revenue ?? null,
      ordersWithMarginData: commerceRow?.orders_with_margin_data ?? 0
    },
    fulfilment: {
      purchaseOrders: ops.purchaseOrders.total,
      awaitingAcknowledgement: ops.purchaseOrders.awaitingAcknowledgement,
      openTrackingExceptions: ops.exceptions.openTrackingExceptions,
      activeSuppliers: supplierCount[0]?.n ?? 0
    },
    catalogue: {
      totalProducts: health.products.total,
      published: health.products.published,
      draft: health.products.draft,
      readyToPublish: readiness.draftReady,
      needsReview: readiness.needsReview,
      blocked: readiness.blocked,
      createNewListingProposals: createNewListingCount[0]?.n ?? 0,
      seoIssues: health.content.seoIssues
    },
    marketing: {
      leads: marketingRow?.leads ?? 0,
      activeSubscribers: marketingRow?.active_subscribers ?? null,
      abandonedCheckouts: commerceRow?.abandoned_checkouts ?? 0,
      welcome10Leads: marketingRow?.welcome10_leads ?? null
    },
    backgroundAutomation: {
      running: automationRow?.running ?? 0,
      completedToday: automationRow?.completed_today ?? 0,
      failed: automationRow?.failed ?? 0,
      needsAttention: automationRow?.needs_attention ?? 0
    },
    ai: {
      pendingHumanDecisions: health.pendingHumanDecisions,
      recentAudits: aiStats[0] ? Number(aiStats[0].n) : 0
    }
  };
}
