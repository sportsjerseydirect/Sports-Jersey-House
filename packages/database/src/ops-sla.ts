/**
 * SLA exception detection — idempotent batch queries.
 * 7-day tracking overdue / 30-day delivery overdue (configurable via ops_sla_settings).
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { orderItems, purchaseOrders } from "./schema-commerce";
import { trackingExceptions } from "./schema-ops";

export type SlaSettings = {
  trackingOverdueDays: number;
  deliveryOverdueDays: number;
};

export type SlaDetectionResult = {
  dryRun: boolean;
  trackingOverdueCreated: number;
  deliveryOverdueCreated: number;
  trackingOverdueCandidates: number;
  deliveryOverdueCandidates: number;
};

async function loadSlaSettings(db: ReturnType<typeof createDatabaseClient>): Promise<SlaSettings> {
  try {
    const rows = await db.execute<{ tracking_overdue_days: number; delivery_overdue_days: number }>(
      sql`select tracking_overdue_days, delivery_overdue_days from ops_sla_settings order by updated_at desc limit 1`
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      trackingOverdueDays: row?.tracking_overdue_days ?? 7,
      deliveryOverdueDays: row?.delivery_overdue_days ?? 30
    };
  } catch {
    return { trackingOverdueDays: 7, deliveryOverdueDays: 30 };
  }
}

export async function detectAndPersistSlaExceptions(
  input: { dryRun?: boolean } = {},
  databaseUrl?: string
): Promise<SlaDetectionResult> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(url);
  const dryRun = input.dryRun ?? true;
  const sla = await loadSlaSettings(db);

  const trackingCandidates = await db.execute<{
    po_id: string;
    po_number: string;
    order_item_id: string;
    order_number: string;
  }>(sql`
    select distinct po.id as po_id, po.po_number, oi.id as order_item_id, o.order_number
    from purchase_orders po
    inner join order_items oi on oi.purchase_order_id = po.id
    inner join orders o on o.id = oi.order_id
    where po.deleted_at is null
      and po.acknowledged_at is not null
      and po.supplier_received_at is not null
      and oi.tracking_number is null
      and oi.deleted_at is null
      and po.supplier_received_at < now() - (${sla.trackingOverdueDays} || ' days')::interval
      and not exists (
        select 1 from tracking_exceptions te
        where te.order_item_id = oi.id
          and te.reason = 'tracking_overdue'
          and te.status = 'open'
          and te.deleted_at is null
      )
  `);

  const deliveryCandidates = await db.execute<{
    order_item_id: string;
    order_number: string;
    tracking_number: string;
  }>(sql`
    select oi.id as order_item_id, o.order_number, oi.tracking_number
    from order_items oi
    inner join orders o on o.id = oi.order_id
    where oi.shipped_at is not null
      and oi.delivered_at is null
      and oi.deleted_at is null
      and oi.shipped_at < now() - (${sla.deliveryOverdueDays} || ' days')::interval
      and not exists (
        select 1 from tracking_exceptions te
        where te.order_item_id = oi.id
          and te.reason = 'delivery_overdue'
          and te.status = 'open'
          and te.deleted_at is null
      )
  `);

  const trackingRows = Array.isArray(trackingCandidates) ? trackingCandidates : [trackingCandidates];
  const deliveryRows = Array.isArray(deliveryCandidates) ? deliveryCandidates : [deliveryCandidates];

  let trackingOverdueCreated = 0;
  let deliveryOverdueCreated = 0;

  if (!dryRun) {
    for (const row of trackingRows) {
      if (!row?.order_item_id) continue;
      await db.insert(trackingExceptions).values({
        rawLine: `SLA: tracking overdue PO ${row.po_number ?? "unknown"}`,
        orderNumber: row.order_number,
        orderItemId: row.order_item_id,
        reason: "tracking_overdue",
        status: "open",
        metadata: { poId: row.po_id, poNumber: row.po_number, slaDays: sla.trackingOverdueDays },
        createdBy: "ops-sla"
      });
      trackingOverdueCreated += 1;
    }

    for (const row of deliveryRows) {
      if (!row?.order_item_id) continue;
      await db.insert(trackingExceptions).values({
        rawLine: `SLA: delivery overdue order ${row.order_number ?? "unknown"}`,
        trackingNumber: row.tracking_number,
        orderNumber: row.order_number,
        orderItemId: row.order_item_id,
        reason: "delivery_overdue",
        status: "open",
        metadata: { slaDays: sla.deliveryOverdueDays },
        createdBy: "ops-sla"
      });
      deliveryOverdueCreated += 1;
    }
  }

  return {
    dryRun,
    trackingOverdueCreated,
    deliveryOverdueCreated,
    trackingOverdueCandidates: trackingRows.filter((r) => r?.order_item_id).length,
    deliveryOverdueCandidates: deliveryRows.filter((r) => r?.order_item_id).length
  };
}

export async function getSlaSettings(databaseUrl?: string): Promise<SlaSettings> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return loadSlaSettings(createDatabaseClient(url));
}

export async function updateSlaSettings(
  input: { trackingOverdueDays: number; deliveryOverdueDays: number; updatedBy?: string },
  databaseUrl?: string
): Promise<SlaSettings> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(url);

  await db.execute(sql`
    insert into ops_sla_settings (tracking_overdue_days, delivery_overdue_days, updated_by)
    values (${input.trackingOverdueDays}, ${input.deliveryOverdueDays}, ${input.updatedBy ?? "admin"})
  `);

  return {
    trackingOverdueDays: input.trackingOverdueDays,
    deliveryOverdueDays: input.deliveryOverdueDays
  };
}
