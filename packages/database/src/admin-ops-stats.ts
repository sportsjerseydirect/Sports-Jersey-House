import { and, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { orderItems, orders, purchaseOrders } from "./schema-commerce";
import { trackingExceptions } from "./schema-ops";

export type AdminOpsStats = {
  orders: {
    total: number;
    pendingPayment: number;
    paidUnfulfilled: number;
    submittedToSupplier: number;
  };
  purchaseOrders: {
    total: number;
    awaitingAcknowledgement: number;
    awaitingTracking: number;
    trackingOverdue: number;
    deliveryOverdue: number;
  };
  exceptions: {
    openTrackingExceptions: number;
  };
  sla: {
    trackingOverdueDays: number;
    deliveryOverdueDays: number;
  };
};

async function loadSlaSettings(db: ReturnType<typeof createDatabaseClient>): Promise<{
  trackingOverdueDays: number;
  deliveryOverdueDays: number;
}> {
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

export async function getAdminOpsStats(databaseUrl?: string): Promise<AdminOpsStats> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(url);
  const sla = await loadSlaSettings(db);

  const [orderStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pendingPayment: sql<number>`count(*) filter (where ${orders.status} = 'pending_payment')::int`,
      paidUnfulfilled: sql<number>`count(*) filter (where ${orders.status} in ('paid','processing') and ${orders.fulfilmentStatus} = 'unfulfilled')::int`,
      submittedToSupplier: sql<number>`count(*) filter (where ${orders.status} = 'submitted_to_supplier')::int`
    })
    .from(orders);

  const trackingThreshold = sql`now() - (${sla.trackingOverdueDays} || ' days')::interval`;
  const deliveryThreshold = sql`now() - (${sla.deliveryOverdueDays} || ' days')::interval`;

  const [poStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      awaitingAcknowledgement: sql<number>`count(*) filter (where ${purchaseOrders.status} in ('sent','ready') and ${purchaseOrders.acknowledgedAt} is null)::int`,
      awaitingTracking: sql<number>`count(*) filter (where ${purchaseOrders.status} in ('sent','acknowledged') and not exists (
        select 1 from order_items oi where oi.purchase_order_id = ${purchaseOrders.id} and oi.tracking_number is not null
      ))::int`
    })
    .from(purchaseOrders);

  const [trackingOverdue] = await db.execute<{ n: number }>(sql`
    select count(distinct po.id)::int as n
    from purchase_orders po
    inner join order_items oi on oi.purchase_order_id = po.id
    where po.deleted_at is null
      and po.supplier_received_at is not null
      and oi.tracking_number is null
      and po.supplier_received_at < ${trackingThreshold}
  `);

  const [deliveryOverdue] = await db.execute<{ n: number }>(sql`
    select count(distinct oi.id)::int as n
    from order_items oi
    inner join orders o on o.id = oi.order_id
    where oi.shipped_at is not null
      and oi.delivered_at is null
      and oi.shipped_at < ${deliveryThreshold}
  `);

  const [exceptions] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trackingExceptions)
    .where(eq(trackingExceptions.status, "open"));

  return {
    orders: {
      total: orderStats?.total ?? 0,
      pendingPayment: orderStats?.pendingPayment ?? 0,
      paidUnfulfilled: orderStats?.paidUnfulfilled ?? 0,
      submittedToSupplier: orderStats?.submittedToSupplier ?? 0
    },
    purchaseOrders: {
      total: poStats?.total ?? 0,
      awaitingAcknowledgement: poStats?.awaitingAcknowledgement ?? 0,
      awaitingTracking: poStats?.awaitingTracking ?? 0,
      trackingOverdue: (Array.isArray(trackingOverdue) ? trackingOverdue[0] : trackingOverdue)?.n ?? 0,
      deliveryOverdue: (Array.isArray(deliveryOverdue) ? deliveryOverdue[0] : deliveryOverdue)?.n ?? 0
    },
    exceptions: { openTrackingExceptions: exceptions?.n ?? 0 },
    sla
  };
}
