import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { products } from "./schema-catalogue";
import {
  orderItems,
  orders,
  productSupplierMappings,
  purchaseOrderLines,
  purchaseOrders,
  suppliers
} from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for supplier operations.");
  }
  return url;
}

export type SupplierSnapshot = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  packingSlipFormat: string;
  isActive: boolean;
};

export type PurchaseOrderLineSnapshot = {
  id: string;
  orderItemId: string;
  quantity: number;
  supplierSku: string | null;
  notes: string | null;
  productTitle: string;
  variantTitle: string;
  sizeLabel: string | null;
  customisation: unknown;
  orderNumber: string;
  shippingDestination: unknown;
};

export type PurchaseOrderSnapshot = {
  id: string;
  poNumber: string;
  status: string;
  batchDate: string | null;
  packingSlipFormat: string | null;
  packingSlipPayload: unknown;
  emailTo: string | null;
  emailSentAt: Date | null;
  notes: string | null;
  supplier: SupplierSnapshot;
  lines: PurchaseOrderLineSnapshot[];
  emailPreview: {
    to: string | null;
    subject: string;
    bodyText: string;
  };
};

export type PoBatchResult = {
  batchDate: string;
  created: PurchaseOrderSnapshot[];
  skippedUnmapped: number;
  eligibleLineCount: number;
};

export async function listSuppliers(databaseUrl?: string): Promise<SupplierSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(suppliers)
    .where(isNull(suppliers.deletedAt))
    .orderBy(suppliers.code);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    packingSlipFormat: row.packingSlipFormat,
    isActive: row.isActive
  }));
}

export async function createSupplier(
  input: {
    code: string;
    name: string;
    email?: string;
    phone?: string;
    packingSlipFormat?: string;
  },
  databaseUrl?: string
): Promise<SupplierSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db
    .insert(suppliers)
    .values({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      packingSlipFormat: input.packingSlipFormat ?? "default_html",
      isActive: true
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create supplier.");
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    packingSlipFormat: row.packingSlipFormat,
    isActive: row.isActive
  };
}

/** Ensures a DEFAULT supplier exists and maps all undeleted products to it as primary. */
export async function ensureDefaultSupplierMappings(databaseUrl?: string): Promise<{
  supplier: SupplierSnapshot;
  mappingsCreated: number;
}> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  let [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.code, "DEFAULT"), isNull(suppliers.deletedAt)))
    .limit(1);

  if (!supplier) {
    const created = await createSupplier(
      {
        code: "DEFAULT",
        name: "Default supplier",
        email: "supplier@example.com",
        packingSlipFormat: "default_html"
      },
      databaseUrl
    );
    [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, created.id)).limit(1);
  }

  if (!supplier) {
    throw new Error("Default supplier missing.");
  }

  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(isNull(products.deletedAt));

  let mappingsCreated = 0;

  for (const product of productRows) {
    const [existing] = await db
      .select({ id: productSupplierMappings.id })
      .from(productSupplierMappings)
      .where(
        and(
          eq(productSupplierMappings.productId, product.id),
          eq(productSupplierMappings.supplierId, supplier.id),
          isNull(productSupplierMappings.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      continue;
    }

    await db.insert(productSupplierMappings).values({
      productId: product.id,
      supplierId: supplier.id,
      isPrimary: true,
      currencyCode: "USD"
    });
    mappingsCreated += 1;
  }

  return {
    supplier: {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      packingSlipFormat: supplier.packingSlipFormat,
      isActive: supplier.isActive
    },
    mappingsCreated
  };
}

function formatCustomisation(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "None";
  }

  const customisation = value as {
    mode?: string;
    name?: string;
    number?: string;
    message?: string;
  };

  switch (customisation.mode) {
    case "name":
      return customisation.name ? `Name: ${customisation.name}` : "Name";
    case "number":
      return customisation.number ? `Number: ${customisation.number}` : "Number";
    case "name_number":
      return [customisation.name, customisation.number ? `#${customisation.number}` : null]
        .filter(Boolean)
        .join(" ") || "Name + number";
    case "message":
      return customisation.message ? `Message: ${customisation.message}` : "Message";
    default:
      return "None";
  }
}

function buildPackingSlipHtml(input: {
  poNumber: string;
  batchDate: string;
  supplierName: string;
  lines: Array<{
    orderNumber: string;
    productTitle: string;
    variantTitle: string;
    sizeLabel: string | null;
    quantity: number;
    supplierSku: string | null;
    customisation: unknown;
    shippingDestination: unknown;
  }>;
}): { html: string; lineCount: number } {
  const rows = input.lines
    .map((line) => {
      const destination =
        line.shippingDestination && typeof line.shippingDestination === "object"
          ? (line.shippingDestination as Record<string, string>)
          : null;
      const shipTo = destination
        ? `${destination.fullName ?? ""} — ${destination.line1 ?? ""}, ${destination.city ?? ""} ${destination.region ?? ""} ${destination.postalCode ?? ""} ${destination.country ?? ""}`
        : "";

      return `<tr>
  <td>${escapeHtml(line.orderNumber)}</td>
  <td>${escapeHtml(line.supplierSku ?? "—")}</td>
  <td>${escapeHtml(line.productTitle)}<br/><small>${escapeHtml(line.variantTitle)}${line.sizeLabel ? ` / ${escapeHtml(line.sizeLabel)}` : ""}</small></td>
  <td>${escapeHtml(formatCustomisation(line.customisation))}</td>
  <td>${line.quantity}</td>
  <td>${escapeHtml(shipTo)}</td>
</tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Packing slip ${escapeHtml(input.poNumber)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; color: #111; margin: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    .meta { color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Packing slip ${escapeHtml(input.poNumber)}</h1>
  <p class="meta">Supplier: ${escapeHtml(input.supplierName)} · Batch date: ${escapeHtml(input.batchDate)} · Lines: ${input.lines.length}</p>
  <table>
    <thead>
      <tr>
        <th>Order</th>
        <th>Supplier SKU</th>
        <th>Item</th>
        <th>Customisation</th>
        <th>Qty</th>
        <th>Ship to</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  return { html, lineCount: input.lines.length };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildEmailPreview(po: {
  poNumber: string;
  batchDate: string | null;
  emailTo: string | null;
  supplierName: string;
  lineCount: number;
}): PurchaseOrderSnapshot["emailPreview"] {
  const batch = po.batchDate ?? "unspecified";
  return {
    to: po.emailTo,
    subject: `Sports Jersey House PO ${po.poNumber} (${batch})`,
    bodyText: [
      `Hello ${po.supplierName},`,
      "",
      `Please find purchase order ${po.poNumber} for batch ${batch}.`,
      `This PO contains ${po.lineCount} line(s).`,
      "",
      "A packing slip is attached / included in the admin preview.",
      "",
      "This is a DRAFT email — not sent automatically.",
      "",
      "Thanks,",
      "Sports Jersey House Ops"
    ].join("\n")
  };
}

async function loadPurchaseOrderSnapshot(
  db: ReturnType<typeof createDatabaseClient>,
  poId: string
): Promise<PurchaseOrderSnapshot | null> {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  if (!po || po.deletedAt) {
    return null;
  }

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, po.supplierId)).limit(1);
  if (!supplier) {
    return null;
  }

  const lines = await db
    .select({
      id: purchaseOrderLines.id,
      orderItemId: purchaseOrderLines.orderItemId,
      quantity: purchaseOrderLines.quantity,
      supplierSku: purchaseOrderLines.supplierSku,
      notes: purchaseOrderLines.notes,
      productTitle: orderItems.productTitle,
      variantTitle: orderItems.variantTitle,
      sizeLabel: orderItems.sizeLabel,
      customisation: orderItems.customisation,
      shippingDestination: orderItems.shippingDestination,
      orderNumber: orders.orderNumber
    })
    .from(purchaseOrderLines)
    .innerJoin(orderItems, eq(purchaseOrderLines.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id));

  const snapshot: PurchaseOrderSnapshot = {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    batchDate: po.batchDate,
    packingSlipFormat: po.packingSlipFormat,
    packingSlipPayload: po.packingSlipPayload,
    emailTo: po.emailTo,
    emailSentAt: po.emailSentAt,
    notes: po.notes,
    supplier: {
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      packingSlipFormat: supplier.packingSlipFormat,
      isActive: supplier.isActive
    },
    lines: lines.map((line) => ({
      id: line.id,
      orderItemId: line.orderItemId,
      quantity: line.quantity,
      supplierSku: line.supplierSku,
      notes: line.notes,
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      sizeLabel: line.sizeLabel,
      customisation: line.customisation,
      orderNumber: line.orderNumber,
      shippingDestination: line.shippingDestination
    })),
    emailPreview: buildEmailPreview({
      poNumber: po.poNumber,
      batchDate: po.batchDate,
      emailTo: po.emailTo,
      supplierName: supplier.name,
      lineCount: lines.length
    })
  };

  return snapshot;
}

export async function getPurchaseOrderByNumber(
  poNumber: string,
  databaseUrl?: string
): Promise<PurchaseOrderSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [po] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.poNumber, poNumber))
    .limit(1);

  if (!po) {
    return null;
  }

  return loadPurchaseOrderSnapshot(db, po.id);
}

export async function listPurchaseOrders(
  limit = 50,
  databaseUrl?: string
): Promise<PurchaseOrderSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(isNull(purchaseOrders.deletedAt))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(limit);

  const snapshots: PurchaseOrderSnapshot[] = [];
  for (const row of rows) {
    const snapshot = await loadPurchaseOrderSnapshot(db, row.id);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

/**
 * Create one PO per supplier for eligible order lines.
 * Eligible: order status paid only, line unfulfilled, no purchase_order_id, resolvable supplier.
 */
export async function createPurchaseOrderBatch(
  batchDate = new Date().toISOString().slice(0, 10),
  databaseUrl?: string
): Promise<PoBatchResult> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const [defaultSupplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.code, "DEFAULT"), isNull(suppliers.deletedAt)))
    .limit(1);
  if (!defaultSupplier) {
    await ensureDefaultSupplierMappings(url);
  }

  const eligible = await db
    .select({
      orderItemId: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      productTitle: orderItems.productTitle,
      variantTitle: orderItems.variantTitle,
      sizeLabel: orderItems.sizeLabel,
      customisation: orderItems.customisation,
      shippingDestination: orderItems.shippingDestination,
      lineSupplierId: orderItems.supplierId,
      orderNumber: orders.orderNumber,
      mappingSupplierId: productSupplierMappings.supplierId,
      supplierSku: productSupplierMappings.supplierSku,
      unitCostAmount: productSupplierMappings.unitCostAmount
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(
      productSupplierMappings,
      and(
        eq(productSupplierMappings.productId, orderItems.productId),
        eq(productSupplierMappings.isPrimary, true),
        isNull(productSupplierMappings.deletedAt)
      )
    )
    .where(
      and(
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
        isNull(orderItems.purchaseOrderId),
        eq(orderItems.fulfilmentStatus, "unfulfilled"),
        eq(orders.status, "paid")
      )
    );

  let skippedUnmapped = 0;
  const bySupplier = new Map<
    string,
    Array<(typeof eligible)[number] & { resolvedSupplierId: string }>
  >();

  for (const line of eligible) {
    const resolvedSupplierId = line.lineSupplierId ?? line.mappingSupplierId;
    if (!resolvedSupplierId) {
      skippedUnmapped += 1;
      continue;
    }

    const bucket = bySupplier.get(resolvedSupplierId) ?? [];
    bucket.push({ ...line, resolvedSupplierId });
    bySupplier.set(resolvedSupplierId, bucket);
  }

  const created: PurchaseOrderSnapshot[] = [];

  for (const [supplierId, lines] of bySupplier.entries()) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .limit(1);

    if (!supplier) {
      skippedUnmapped += lines.length;
      continue;
    }

    const packing = buildPackingSlipHtml({
      poNumber: "PENDING",
      batchDate,
      supplierName: supplier.name,
      lines: lines.map((line) => ({
        orderNumber: line.orderNumber,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
        supplierSku: line.supplierSku,
        customisation: line.customisation,
        shippingDestination: line.shippingDestination
      }))
    });

    const [po] = await db
      .insert(purchaseOrders)
      .values({
        supplierId: supplier.id,
        status: "sent",
        batchDate,
        packingSlipFormat: supplier.packingSlipFormat,
        packingSlipPayload: {
          format: "default_html",
          html: packing.html,
          lineCount: packing.lineCount,
          generatedAt: new Date().toISOString()
        },
        emailTo: supplier.email,
        notes: `Auto-batch ${batchDate}`
      })
      .returning();

    if (!po) {
      throw new Error("Failed to create purchase order.");
    }

    // Refresh packing slip with real PO number
    const packingFinal = buildPackingSlipHtml({
      poNumber: po.poNumber,
      batchDate,
      supplierName: supplier.name,
      lines: lines.map((line) => ({
        orderNumber: line.orderNumber,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sizeLabel: line.sizeLabel,
        quantity: line.quantity,
        supplierSku: line.supplierSku,
        customisation: line.customisation,
        shippingDestination: line.shippingDestination
      }))
    });

    await db
      .update(purchaseOrders)
      .set({
        packingSlipPayload: {
          format: "default_html",
          html: packingFinal.html,
          lineCount: packingFinal.lineCount,
          generatedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(purchaseOrders.id, po.id));

    await db.insert(purchaseOrderLines).values(
      lines.map((line) => ({
        purchaseOrderId: po.id,
        orderItemId: line.orderItemId,
        quantity: line.quantity,
        supplierSku: line.supplierSku,
        notes: null
      }))
    );

    for (const line of lines) {
      const supplierCost =
        line.unitCostAmount != null
          ? (Number.parseFloat(String(line.unitCostAmount)) * line.quantity).toFixed(2)
          : null;
      await db
        .update(orderItems)
        .set({
          purchaseOrderId: po.id,
          supplierId: supplier.id,
          fulfilmentStatus: "submitted",
          ...(supplierCost !== null ? { supplierCostAmount: supplierCost } : {}),
          updatedAt: new Date()
        })
        .where(eq(orderItems.id, line.orderItemId));
    }

    const orderIds = [...new Set(lines.map((line) => line.orderId))];
    for (const orderId of orderIds) {
      const remaining = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            isNull(orderItems.deletedAt),
            isNull(orderItems.purchaseOrderId)
          )
        )
        .limit(1);

      if (remaining.length === 0) {
        await db
          .update(orders)
          .set({
            status: "submitted_to_supplier",
            fulfilmentStatus: "submitted",
            updatedAt: new Date()
          })
          .where(eq(orders.id, orderId));
      }
    }

    const snapshot = await loadPurchaseOrderSnapshot(db, po.id);
    if (snapshot) {
      created.push(snapshot);
    }
  }

  return {
    batchDate,
    created,
    skippedUnmapped,
    eligibleLineCount: eligible.length
  };
}

export async function updateSupplier(
  id: string,
  fields: {
    code?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
    packingSlipFormat?: string;
    courierNotes?: string | null;
    trackingNotes?: string | null;
    metadata?: Record<string, unknown>;
  },
  databaseUrl?: string
): Promise<SupplierSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [existing] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Supplier not found.");
  }

  const [updated] = await db
    .update(suppliers)
    .set({
      ...(fields.code !== undefined ? { code: fields.code.trim().toUpperCase() } : {}),
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.email !== undefined
        ? { email: fields.email === null ? null : fields.email.trim() || null }
        : {}),
      ...(fields.phone !== undefined
        ? { phone: fields.phone === null ? null : fields.phone.trim() || null }
        : {}),
      ...(fields.packingSlipFormat !== undefined
        ? { packingSlipFormat: fields.packingSlipFormat }
        : {}),
      ...(fields.courierNotes !== undefined ? { courierNotes: fields.courierNotes } : {}),
      ...(fields.trackingNotes !== undefined ? { trackingNotes: fields.trackingNotes } : {}),
      ...(fields.metadata !== undefined ? { metadata: fields.metadata } : {}),
      updatedAt: new Date()
    })
    .where(eq(suppliers.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update supplier.");
  }

  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    packingSlipFormat: updated.packingSlipFormat,
    isActive: updated.isActive
  };
}

export async function setSupplierActive(
  id: string,
  isActive: boolean,
  databaseUrl?: string
): Promise<SupplierSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [updated] = await db
    .update(suppliers)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)))
    .returning();

  if (!updated) {
    throw new Error("Supplier not found.");
  }

  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    packingSlipFormat: updated.packingSlipFormat,
    isActive: updated.isActive
  };
}

export type ProductSupplierMappingSnapshot = {
  id: string;
  productId: string;
  supplierId: string;
  supplierSku: string | null;
  unitCostAmount: string | null;
  currencyCode: string;
  isPrimary: boolean;
  leadTimeDays: number | null;
};

export async function upsertProductSupplierMapping(
  input: {
    productId: string;
    supplierId: string;
    supplierSku?: string;
    unitCostAmount?: string;
    isPrimary?: boolean;
  },
  databaseUrl?: string
): Promise<ProductSupplierMappingSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const isPrimary = input.isPrimary ?? false;

  if (isPrimary) {
    await db
      .update(productSupplierMappings)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(productSupplierMappings.productId, input.productId),
          isNull(productSupplierMappings.deletedAt)
        )
      );
  }

  const [existing] = await db
    .select()
    .from(productSupplierMappings)
    .where(
      and(
        eq(productSupplierMappings.productId, input.productId),
        eq(productSupplierMappings.supplierId, input.supplierId),
        isNull(productSupplierMappings.deletedAt)
      )
    )
    .limit(1);

  let row: typeof productSupplierMappings.$inferSelect | undefined;

  if (existing) {
    const [updated] = await db
      .update(productSupplierMappings)
      .set({
        ...(input.supplierSku !== undefined
          ? { supplierSku: input.supplierSku.trim() || null }
          : {}),
        ...(input.unitCostAmount !== undefined
          ? { unitCostAmount: input.unitCostAmount || null }
          : {}),
        isPrimary,
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(productSupplierMappings.id, existing.id))
      .returning();
    row = updated;
  } else {
    const [created] = await db
      .insert(productSupplierMappings)
      .values({
        productId: input.productId,
        supplierId: input.supplierId,
        isPrimary,
        currencyCode: "USD",
        ...(input.supplierSku !== undefined
          ? { supplierSku: input.supplierSku.trim() || null }
          : {}),
        ...(input.unitCostAmount !== undefined
          ? { unitCostAmount: input.unitCostAmount || null }
          : {})
      })
      .returning();
    row = created;
  }

  if (!row) {
    throw new Error("Failed to upsert product supplier mapping.");
  }

  return {
    id: row.id,
    productId: row.productId,
    supplierId: row.supplierId,
    supplierSku: row.supplierSku,
    unitCostAmount: row.unitCostAmount,
    currencyCode: row.currencyCode,
    isPrimary: row.isPrimary,
    leadTimeDays: row.leadTimeDays
  };
}

export async function listProductSupplierMappings(
  productId?: string,
  databaseUrl?: string
): Promise<ProductSupplierMappingSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = productId
    ? await db
        .select()
        .from(productSupplierMappings)
        .where(
          and(
            eq(productSupplierMappings.productId, productId),
            isNull(productSupplierMappings.deletedAt)
          )
        )
        .orderBy(desc(productSupplierMappings.isPrimary), productSupplierMappings.createdAt)
    : await db
        .select()
        .from(productSupplierMappings)
        .where(isNull(productSupplierMappings.deletedAt))
        .orderBy(desc(productSupplierMappings.createdAt))
        .limit(200);

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    supplierId: row.supplierId,
    supplierSku: row.supplierSku,
    unitCostAmount: row.unitCostAmount,
    currencyCode: row.currencyCode,
    isPrimary: row.isPrimary,
    leadTimeDays: row.leadTimeDays
  }));
}
