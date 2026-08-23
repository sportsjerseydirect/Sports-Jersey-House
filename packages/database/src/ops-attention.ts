import { sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { getAdminCommandCentreStats } from "./admin-command-centre";
import { listIssueCases } from "./issues";
import { getCatalogueHealthStats } from "./catalogue-health";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

/** Aggregated “what needs attention today” — read-only, real DB counts. */
export async function getOpsAttentionBrief(databaseUrl?: string) {
  const stats = await getAdminCommandCentreStats(databaseUrl);
  const issues = await listIssueCases(20, databaseUrl);
  const openIssues = issues.filter((row) =>
    ["open", "investigating", "awaiting_customer", "awaiting_supplier"].includes(row.status)
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ordersNeedingAttention: stats.actionRequired.ordersNeedingAttention,
      trackingOverdue: stats.actionRequired.trackingOverdue,
      deliveryOverdue: stats.actionRequired.deliveryOverdue,
      supplierIssues: stats.actionRequired.supplierIssues,
      customerIssues: stats.actionRequired.customerIssues,
      replacementCases: stats.actionRequired.replacementCases,
      lowMarginOrders: stats.actionRequired.lowMarginOrders,
      chargebackRisk: stats.actionRequired.chargebackRisk,
      backgroundNeedsAttention: stats.backgroundAutomation.needsAttention
    },
    openIssueSample: openIssues.slice(0, 10).map((row) => ({
      caseNumber: row.caseNumber,
      orderNumber: row.orderNumber,
      reason: row.reason,
      status: row.status,
      replacementOrderNumber: row.replacementOrderNumber
    })),
    nextLinks: {
      orders: "/admin/orders",
      trackingExceptions: "/admin/tracking/exceptions",
      issues: "/admin/issues",
      margins: "/admin/margins",
      jobs: "/admin/jobs"
    }
  };
}

export async function listTrackingOverdueForOps(limit = 50, databaseUrl?: string) {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    po_number: string;
    supplier_name: string;
    supplier_received_at: string | null;
    order_number: string;
    product_title: string;
    days_waiting: number;
  }>(sql`
    select
      po.po_number,
      s.name as supplier_name,
      po.supplier_received_at::text,
      o.order_number,
      oi.product_title,
      extract(day from now() - po.supplier_received_at)::int as days_waiting
    from purchase_orders po
    inner join suppliers s on s.id = po.supplier_id
    inner join order_items oi on oi.purchase_order_id = po.id
    inner join orders o on o.id = oi.order_id
    where po.deleted_at is null
      and po.supplier_received_at is not null
      and oi.tracking_number is null
      and po.supplier_received_at < now() - interval '7 days'
    order by po.supplier_received_at asc
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : [];
  return { count: list.length, rows: list };
}

export async function listDeliveryOverdueForOps(limit = 50, databaseUrl?: string) {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    order_number: string;
    product_title: string;
    tracking_number: string | null;
    shipped_at: string | null;
    days_in_transit: number;
  }>(sql`
    select
      o.order_number,
      oi.product_title,
      oi.tracking_number,
      oi.shipped_at::text,
      extract(day from now() - oi.shipped_at)::int as days_in_transit
    from order_items oi
    inner join orders o on o.id = oi.order_id
    where oi.shipped_at is not null
      and oi.delivered_at is null
      and oi.shipped_at < now() - interval '30 days'
    order by oi.shipped_at asc
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : [];
  return { count: list.length, rows: list };
}

export async function listLowMarginOrdersForOps(limit = 40, databaseUrl?: string) {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    order_number: string;
    product_title: string;
    net_revenue: string;
    total_cost: string;
    margin_percent: number;
  }>(sql`
    select
      o.order_number,
      oi.product_title,
      (
        coalesce(oi.unit_price_amount::numeric, 0) * oi.quantity
        + coalesce(oi.customisation_price_amount::numeric, 0) * oi.quantity
        - coalesce(oi.discount_amount::numeric, 0)
      )::text as net_revenue,
      (
        coalesce(oi.supplier_cost_amount::numeric, 0)
        + coalesce(oi.fulfilment_cost_amount::numeric, 0)
        + coalesce(oi.customisation_cost_amount::numeric, 0)
        + coalesce(oi.other_cost_amount::numeric, 0)
      )::text as total_cost,
      round((
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
        ) * 100
      )::numeric, 2)::float as margin_percent
    from order_items oi
    inner join orders o on o.id = oi.order_id
    where o.deleted_at is null
      and oi.supplier_cost_amount is not null
      and (
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
    order by margin_percent asc nulls last
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : [];
  return { count: list.length, thresholdPercent: 20, rows: list };
}

export async function listPoorSeoProductsForOps(limit = 40, databaseUrl?: string) {
  const health = await getCatalogueHealthStats(databaseUrl);
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    slug: string;
    title: string;
    status: string;
    issue: string;
  }>(sql`
    select
      p.slug,
      p.title,
      p.status,
      case
        when s.id is null then 'missing_seo_record'
        when coalesce(trim(s.meta_description), '') = '' then 'missing_meta_description'
        when coalesce(trim(s.canonical_path), '') = '' then 'missing_canonical'
        else 'seo_gap'
      end as issue
    from products p
    left join seo_records s
      on s.target_type = 'product'
     and s.target_id = p.id
     and s.deleted_at is null
    where p.deleted_at is null
      and p.status = 'published'
      and (
        s.id is null
        or coalesce(trim(s.meta_description), '') = ''
        or coalesce(trim(s.canonical_path), '') = ''
      )
    order by p.updated_at desc
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : [];
  return {
    seoIssueCount: health.content.seoIssues,
    count: list.length,
    rows: list,
    note: "Titles are never rewritten by this tool."
  };
}
