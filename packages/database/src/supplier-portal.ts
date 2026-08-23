import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { productImages, products } from "./schema-catalogue";
import {
  orderItems,
  orders,
  purchaseOrderLines,
  purchaseOrders,
  suppliers
} from "./schema-commerce";
import { matchCourier } from "./tracking";

function resolveUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

export type SupplierPoBucket =
  | "new"
  | "awaiting_acknowledgement"
  | "in_production"
  | "awaiting_tracking"
  | "tracking_overdue"
  | "dispatched"
  | "delivered"
  | "delivery_overdue"
  | "issues"
  | "completed";

export type SupplierDashboardStats = {
  buckets: Record<SupplierPoBucket, number>;
  orders: SupplierPoSummary[];
};

export function classifySupplierPoBucket(
  po: Pick<
    SupplierPoSummary,
    "status" | "acknowledgedAt" | "awaitingTracking" | "supplierReceivedAt"
  > & { allShipped?: boolean; allDelivered?: boolean; hasOpenIssue?: boolean },
  sla?: { trackingOverdueDays: number }
): SupplierPoBucket {
  if (po.hasOpenIssue) return "issues";
  if (po.status === "fulfilled" || po.allDelivered) return "completed";
  if (po.allShipped && !po.allDelivered) return "dispatched";

  const trackingDays = sla?.trackingOverdueDays ?? 7;
  const receivedAt = po.supplierReceivedAt ?? po.acknowledgedAt;
  const trackingOverdue =
    receivedAt &&
    po.awaitingTracking &&
    Date.now() - receivedAt.getTime() > trackingDays * 24 * 60 * 60 * 1000;

  if (trackingOverdue) return "tracking_overdue";
  if (!po.acknowledgedAt && ["sent", "ready"].includes(po.status)) return "new";
  if (!po.acknowledgedAt) return "awaiting_acknowledgement";
  if (po.status === "acknowledged" && po.awaitingTracking) return "in_production";
  if (po.awaitingTracking) return "awaiting_tracking";
  return "completed";
}

async function syncPurchaseOrderFulfilmentStatus(
  db: ReturnType<typeof createDatabaseClient>,
  poId: string
): Promise<void> {
  const lines = await db
    .select({
      fulfilmentStatus: orderItems.fulfilmentStatus,
      trackingNumber: orderItems.trackingNumber
    })
    .from(orderItems)
    .where(eq(orderItems.purchaseOrderId, poId));

  if (lines.length === 0) return;

  const allShipped = lines.every(
    (l) => l.trackingNumber || ["shipped", "delivered"].includes(l.fulfilmentStatus)
  );
  const allDelivered = lines.every((l) => l.fulfilmentStatus === "delivered");
  const now = new Date();

  if (allDelivered) {
    await db
      .update(purchaseOrders)
      .set({ status: "fulfilled", updatedAt: now })
      .where(eq(purchaseOrders.id, poId));
  } else if (allShipped) {
    await db
      .update(purchaseOrders)
      .set({ status: "acknowledged", dispatchedAt: now, updatedAt: now })
      .where(eq(purchaseOrders.id, poId));
  }
}

export type SupplierPoSummary = {
  id: string;
  poNumber: string;
  status: string;
  batchDate: string | null;
  acknowledgedAt: Date | null;
  supplierReceivedAt: Date | null;
  lineCount: number;
  awaitingTracking: boolean;
  allShipped: boolean;
  bucket: SupplierPoBucket;
  createdAt: Date;
};

export type SupplierPoLineView = {
  id: string;
  productTitle: string;
  sizeLabel: string | null;
  quantity: number;
  customisation: {
    mode: string;
    name?: string;
    number?: string;
    message?: string;
  };
  imageUrl: string | null;
  fulfilmentStatus: string;
  trackingNumber: string | null;
  courier: string | null;
  shippedAt: Date | null;
  orderNumber: string;
  shippingAddress: unknown;
};

export type SupplierPoDetail = {
  poNumber: string;
  status: string;
  acknowledgedAt: Date | null;
  supplierReceivedAt: Date | null;
  supplierCostAmount: string | null;
  supplierCostNotes: string | null;
  packingSlipHtml: string | null;
  lines: SupplierPoLineView[];
};

export async function getSupplierDashboard(
  supplierId: string,
  databaseUrl?: string
): Promise<SupplierDashboardStats> {
  const orders = await listSupplierPurchaseOrders(supplierId, databaseUrl);
  const buckets = {
    new: 0,
    awaiting_acknowledgement: 0,
    in_production: 0,
    awaiting_tracking: 0,
    tracking_overdue: 0,
    dispatched: 0,
    delivered: 0,
    delivery_overdue: 0,
    issues: 0,
    completed: 0
  } satisfies Record<SupplierPoBucket, number>;

  for (const po of orders) {
    buckets[po.bucket] += 1;
  }

  return { buckets, orders };
}

async function assertSupplierOwnsPo(
  db: ReturnType<typeof createDatabaseClient>,
  supplierId: string,
  poNumber: string
): Promise<typeof purchaseOrders.$inferSelect> {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.poNumber, poNumber), eq(purchaseOrders.supplierId, supplierId)))
    .limit(1);

  if (!po) {
    throw new Error("Purchase order not found.");
  }

  return po;
}

export async function listSupplierPurchaseOrders(
  supplierId: string,
  databaseUrl?: string
): Promise<SupplierPoSummary[]> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));

  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      batchDate: purchaseOrders.batchDate,
      acknowledgedAt: purchaseOrders.acknowledgedAt,
      supplierReceivedAt: purchaseOrders.supplierReceivedAt,
      createdAt: purchaseOrders.createdAt,
      lineCount: sql<number>`(
        select count(*)::int from purchase_order_lines pol where pol.purchase_order_id = ${purchaseOrders.id}
      )`,
      awaitingTracking: sql<boolean>`exists (
        select 1 from order_items oi
        where oi.purchase_order_id = ${purchaseOrders.id}
          and oi.tracking_number is null
      )`,
      allShipped: sql<boolean>`not exists (
        select 1 from order_items oi
        where oi.purchase_order_id = ${purchaseOrders.id}
          and oi.tracking_number is null
      )`
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, supplierId))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    poNumber: row.poNumber,
    status: row.status,
    batchDate: row.batchDate,
    acknowledgedAt: row.acknowledgedAt,
    supplierReceivedAt: row.supplierReceivedAt,
    lineCount: row.lineCount,
    awaitingTracking: row.awaitingTracking,
    allShipped: row.allShipped,
    bucket: classifySupplierPoBucket({
      status: row.status,
      acknowledgedAt: row.acknowledgedAt,
      awaitingTracking: row.awaitingTracking,
      supplierReceivedAt: row.supplierReceivedAt,
      allShipped: row.allShipped
    }),
    createdAt: row.createdAt
  }));
}

export async function getSupplierPurchaseOrderDetail(
  supplierId: string,
  poNumber: string,
  databaseUrl?: string
): Promise<SupplierPoDetail> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const po = await assertSupplierOwnsPo(db, supplierId, poNumber);

  const lines = await db
    .select({
      id: orderItems.id,
      productTitle: orderItems.productTitle,
      sizeLabel: orderItems.sizeLabel,
      quantity: orderItems.quantity,
      customisation: orderItems.customisation,
      fulfilmentStatus: orderItems.fulfilmentStatus,
      trackingNumber: orderItems.trackingNumber,
      courier: orderItems.courier,
      shippedAt: orderItems.shippedAt,
      orderNumber: orders.orderNumber,
      shippingAddress: orders.shippingAddress,
      productId: orderItems.productId
    })
    .from(purchaseOrderLines)
    .innerJoin(orderItems, eq(orderItems.id, purchaseOrderLines.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id));

  const productIds = lines.map((l) => l.productId).filter(Boolean) as string[];
  const images =
    productIds.length > 0
      ? await db
          .select({ productId: productImages.productId, url: productImages.url })
          .from(productImages)
          .where(and(inArraySafe(productIds, productImages.productId), isNull(productImages.deletedAt)))
      : [];

  const imageByProduct = new Map<string, string>();
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url);
  }

  return {
    poNumber: po.poNumber,
    status: po.status,
    acknowledgedAt: po.acknowledgedAt ?? null,
    supplierReceivedAt: po.supplierReceivedAt ?? null,
    supplierCostAmount: po.supplierCostAmount ?? null,
    supplierCostNotes: po.supplierCostNotes ?? null,
    packingSlipHtml:
      po.packingSlipPayload &&
      typeof po.packingSlipPayload === "object" &&
      "html" in (po.packingSlipPayload as Record<string, unknown>)
        ? String((po.packingSlipPayload as { html: string }).html)
        : null,
    lines: lines.map((line) => {
      const custom = (line.customisation ?? { mode: "none" }) as Record<string, string>;
      return {
        id: line.id,
        productTitle: line.productTitle,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
        customisation: {
          mode: custom.mode ?? "none",
          ...(custom.name ? { name: custom.name } : {}),
          ...(custom.number ? { number: custom.number } : {}),
          ...(custom.message ? { message: custom.message } : {})
        },
        imageUrl: line.productId ? imageByProduct.get(line.productId) ?? null : null,
        fulfilmentStatus: line.fulfilmentStatus,
        trackingNumber: line.trackingNumber,
        courier: line.courier,
        shippedAt: line.shippedAt,
        orderNumber: line.orderNumber,
        shippingAddress: line.shippingAddress
      };
    })
  };
}

function inArraySafe(ids: string[], column: typeof productImages.productId) {
  return sql`${column} in (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  )})`;
}

export async function supplierAcknowledgePo(
  supplierId: string,
  supplierUserId: string,
  poNumber: string,
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const po = await assertSupplierOwnsPo(db, supplierId, poNumber);
  const now = new Date();

  await db
    .update(purchaseOrders)
    .set({
      status: "acknowledged",
      acknowledgedAt: now,
      supplierReceivedAt: po.supplierReceivedAt ?? now,
      updatedAt: now
    })
    .where(eq(purchaseOrders.id, po.id));

  await db
    .update(orderItems)
    .set({ fulfilmentStatus: "in_production", updatedAt: now })
    .where(eq(orderItems.purchaseOrderId, po.id));

  await db.execute(sql`
    insert into supplier_action_audits (supplier_id, supplier_user_id, action, entity_type, entity_id, new_value)
    values (${supplierId}::uuid, ${supplierUserId}::uuid, 'acknowledge', 'purchase_order', ${po.id}::uuid, ${JSON.stringify({ poNumber })}::jsonb)
  `);
}

export async function supplierSubmitTracking(
  supplierId: string,
  supplierUserId: string,
  input: {
    poNumber: string;
    orderItemId: string;
    trackingNumber: string;
    courier?: string;
    note?: string;
  },
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const po = await assertSupplierOwnsPo(db, supplierId, input.poNumber);

  const [line] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.purchaseOrderId, po.id)))
    .limit(1);

  if (!line) throw new Error("Order line not found on this purchase order.");

  const now = new Date();
  const trackingNumber = input.trackingNumber.trim();
  const matched = await matchCourier(trackingNumber, resolveUrl(databaseUrl));
  const courier = input.courier?.trim() || matched?.courierName || null;

  await db
    .update(orderItems)
    .set({
      trackingNumber,
      courier,
      fulfilmentStatus: "shipped",
      shippedAt: now,
      updatedAt: now
    })
    .where(eq(orderItems.id, line.id));

  await db
    .update(purchaseOrders)
    .set({ dispatchedAt: now, updatedAt: now })
    .where(eq(purchaseOrders.id, po.id));

  await syncPurchaseOrderFulfilmentStatus(db, po.id);

  await db.execute(sql`
    insert into supplier_action_audits (supplier_id, supplier_user_id, action, entity_type, entity_id, new_value, notes)
    values (${supplierId}::uuid, ${supplierUserId}::uuid, 'add_tracking', 'order_item', ${line.id}::uuid,
      ${JSON.stringify({ trackingNumber: input.trackingNumber, courier: input.courier ?? null })}::jsonb,
      ${input.note ?? null})
  `);
}

export async function supplierSubmitCost(
  supplierId: string,
  supplierUserId: string,
  input: { poNumber: string; amount: string; shippingCost?: string; notes?: string },
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const po = await assertSupplierOwnsPo(db, supplierId, input.poNumber);
  const now = new Date();

  const noteParts = [input.notes?.trim()].filter(Boolean);
  if (input.shippingCost?.trim()) {
    noteParts.push(`Shipping cost: ${input.shippingCost.trim()}`);
  }

  await db
    .update(purchaseOrders)
    .set({
      supplierCostAmount: input.amount,
      supplierCostNotes: noteParts.length > 0 ? noteParts.join("\n") : null,
      supplierCostSubmittedAt: now,
      updatedAt: now
    })
    .where(eq(purchaseOrders.id, po.id));

  await db.execute(sql`
    insert into supplier_action_audits (supplier_id, supplier_user_id, action, entity_type, entity_id, new_value)
    values (${supplierId}::uuid, ${supplierUserId}::uuid, 'submit_cost', 'purchase_order', ${po.id}::uuid,
      ${JSON.stringify({ amount: input.amount })}::jsonb)
  `);
}

export async function verifySupplierLogin(
  email: string,
  password: string,
  passwordDigest: string
): Promise<boolean> {
  const digest = await hashSupplierPassword(password);
  return digest === passwordDigest;
}

export async function hashSupplierPassword(password: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "dev-only-auth-secret-change-me";
  const data = new TextEncoder().encode(`sjh-supplier:${secret}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSupplierUserByEmail(
  email: string,
  databaseUrl?: string
): Promise<{ id: string; supplierId: string; email: string; passwordDigest: string; displayName: string | null; supplierName: string; supplierCode: string } | null> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const rows = await db.execute<{
    id: string;
    supplier_id: string;
    email: string;
    password_digest: string;
    display_name: string | null;
    supplier_name: string;
    supplier_code: string;
  }>(sql`
    select su.id, su.supplier_id, su.email, su.password_digest, su.display_name,
           s.name as supplier_name, s.code as supplier_code
    from supplier_users su
    inner join suppliers s on s.id = su.supplier_id
    where lower(su.email) = lower(${email.trim()})
      and su.deleted_at is null
      and su.is_active = true
      and s.is_active = true
    limit 1
  `);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  return {
    id: row.id,
    supplierId: row.supplier_id,
    email: row.email,
    passwordDigest: row.password_digest,
    displayName: row.display_name,
    supplierName: row.supplier_name,
    supplierCode: row.supplier_code
  };
}

export async function bootstrapSupplierUser(
  input: { supplierCode: string; email: string; password: string; displayName?: string },
  databaseUrl?: string
): Promise<{ email: string; supplierCode: string }> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.code, input.supplierCode.toUpperCase()), eq(suppliers.isActive, true)))
    .limit(1);

  if (!supplier) throw new Error(`Supplier ${input.supplierCode} not found.`);

  const digest = await hashSupplierPassword(input.password);
  await db.execute(sql`
    insert into supplier_users (supplier_id, email, password_digest, display_name, created_by)
    values (${supplier.id}::uuid, ${input.email.trim().toLowerCase()}, ${digest}, ${input.displayName ?? null}, 'bootstrap')
    on conflict do nothing
  `);

  return { email: input.email, supplierCode: input.supplierCode.toUpperCase() };
}
