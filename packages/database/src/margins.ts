import { and, desc, eq, isNull } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { orderItems, orders, productSupplierMappings } from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for margin operations.");
  }
  return url;
}

function money(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export type LineMarginSnapshot = {
  orderItemId: string;
  orderNumber: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  currencyCode: string;
  sellAmount: string;
  discountAmount: string;
  customisationRevenueAmount: string;
  netRevenueAmount: string;
  supplierCostAmount: string;
  customisationCostAmount: string;
  fulfilmentCostAmount: string;
  otherCostAmount: string;
  totalCostAmount: string;
  grossProfitAmount: string;
  marginPercent: number | null;
};

export type OrderMarginSnapshot = {
  orderId: string;
  orderNumber: string;
  status: string;
  currencyCode: string;
  shippingRevenueAmount: string;
  paymentFeeAmount: string;
  taxAmount: string;
  orderSubtotalAmount: string;
  orderTotalAmount: string;
  lines: LineMarginSnapshot[];
  totals: {
    netRevenueAmount: string;
    totalCostAmount: string;
    grossProfitAmount: string;
    marginPercent: number | null;
  };
};

export function computeLineMargin(input: {
  unitPriceAmount: string;
  customisationPriceAmount: string;
  discountAmount: string;
  quantity: number;
  supplierCostAmount: string | null;
  customisationCostAmount: string | null;
  fulfilmentCostAmount: string | null;
  otherCostAmount: string | null;
}): {
  sellAmount: number;
  discountAmount: number;
  customisationRevenueAmount: number;
  netRevenueAmount: number;
  totalCostAmount: number;
  grossProfitAmount: number;
  marginPercent: number | null;
} {
  const sellAmount = money(input.unitPriceAmount) * input.quantity;
  const customisationRevenueAmount = money(input.customisationPriceAmount) * input.quantity;
  const discountAmount = money(input.discountAmount);
  const netRevenueAmount = sellAmount + customisationRevenueAmount - discountAmount;
  const totalCostAmount =
    money(input.supplierCostAmount) +
    money(input.customisationCostAmount) +
    money(input.fulfilmentCostAmount) +
    money(input.otherCostAmount);
  const grossProfitAmount = netRevenueAmount - totalCostAmount;
  const marginPercent =
    netRevenueAmount > 0 ? Math.round((grossProfitAmount / netRevenueAmount) * 10_000) / 100 : null;

  return {
    sellAmount,
    discountAmount,
    customisationRevenueAmount,
    netRevenueAmount,
    totalCostAmount,
    grossProfitAmount,
    marginPercent
  };
}

export async function getOrderMargins(
  orderNumber: string,
  databaseUrl?: string
): Promise<OrderMarginSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || order.deletedAt) {
    return null;
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.deletedAt)));

  const lines: LineMarginSnapshot[] = items.map((item) => {
    const computed = computeLineMargin({
      unitPriceAmount: item.unitPriceAmount,
      customisationPriceAmount: item.customisationPriceAmount,
      discountAmount: item.discountAmount,
      quantity: item.quantity,
      supplierCostAmount: item.supplierCostAmount,
      customisationCostAmount: item.customisationCostAmount,
      fulfilmentCostAmount: item.fulfilmentCostAmount,
      otherCostAmount: item.otherCostAmount
    });

    return {
      orderItemId: item.id,
      orderNumber: order.orderNumber,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      currencyCode: item.currencyCode,
      sellAmount: formatMoney(computed.sellAmount),
      discountAmount: formatMoney(computed.discountAmount),
      customisationRevenueAmount: formatMoney(computed.customisationRevenueAmount),
      netRevenueAmount: formatMoney(computed.netRevenueAmount),
      supplierCostAmount: formatMoney(money(item.supplierCostAmount)),
      customisationCostAmount: formatMoney(money(item.customisationCostAmount)),
      fulfilmentCostAmount: formatMoney(money(item.fulfilmentCostAmount)),
      otherCostAmount: formatMoney(money(item.otherCostAmount)),
      totalCostAmount: formatMoney(computed.totalCostAmount),
      grossProfitAmount: formatMoney(computed.grossProfitAmount),
      marginPercent: computed.marginPercent
    };
  });

  const lineNet = lines.reduce((sum, line) => sum + money(line.netRevenueAmount), 0);
  const shippingRevenue = money(order.shippingRevenueAmount);
  const paymentFee = money(order.paymentFeeAmount);
  const netRevenueAmount = lineNet + shippingRevenue - paymentFee;
  const totalCostAmount = lines.reduce((sum, line) => sum + money(line.totalCostAmount), 0);
  const grossProfitAmount = netRevenueAmount - totalCostAmount;
  const marginPercent =
    netRevenueAmount > 0 ? Math.round((grossProfitAmount / netRevenueAmount) * 10_000) / 100 : null;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currencyCode: order.currencyCode,
    shippingRevenueAmount: order.shippingRevenueAmount,
    paymentFeeAmount: order.paymentFeeAmount,
    taxAmount: order.taxAmount,
    orderSubtotalAmount: order.subtotalAmount,
    orderTotalAmount: order.totalAmount,
    lines,
    totals: {
      netRevenueAmount: formatMoney(netRevenueAmount),
      totalCostAmount: formatMoney(totalCostAmount),
      grossProfitAmount: formatMoney(grossProfitAmount),
      marginPercent
    }
  };
}

export async function listRecentOrderMargins(
  limit = 50,
  databaseUrl?: string
): Promise<OrderMarginSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .orderBy(desc(orders.placedAt), desc(orders.createdAt))
    .limit(limit);

  const snapshots: OrderMarginSnapshot[] = [];
  for (const row of rows) {
    const snapshot = await getOrderMargins(row.orderNumber, databaseUrl);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

export async function updateOrderItemCosts(
  orderItemId: string,
  costs: {
    supplierCostAmount?: string;
    customisationCostAmount?: string;
    fulfilmentCostAmount?: string;
    otherCostAmount?: string;
  },
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  await db
    .update(orderItems)
    .set({
      ...(costs.supplierCostAmount !== undefined ? { supplierCostAmount: costs.supplierCostAmount } : {}),
      ...(costs.customisationCostAmount !== undefined
        ? { customisationCostAmount: costs.customisationCostAmount }
        : {}),
      ...(costs.fulfilmentCostAmount !== undefined
        ? { fulfilmentCostAmount: costs.fulfilmentCostAmount }
        : {}),
      ...(costs.otherCostAmount !== undefined ? { otherCostAmount: costs.otherCostAmount } : {}),
      updatedAt: new Date()
    })
    .where(eq(orderItems.id, orderItemId));
}

/** Apply primary product supplier unit cost × quantity when supplier cost is null. */
export async function applyMappedSupplierCosts(
  orderNumber: string,
  databaseUrl?: string
): Promise<number> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || order.deletedAt) {
    throw new Error("Order not found.");
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.deletedAt)));

  let updated = 0;
  for (const item of items) {
    if (item.supplierCostAmount !== null || !item.productId) {
      continue;
    }

    const productId = item.productId;

    const [mapping] = await db
      .select({
        unitCostAmount: productSupplierMappings.unitCostAmount
      })
      .from(productSupplierMappings)
      .where(
        and(
          eq(productSupplierMappings.productId, productId),
          eq(productSupplierMappings.isPrimary, true),
          isNull(productSupplierMappings.deletedAt)
        )
      )
      .limit(1);

    if (!mapping?.unitCostAmount) {
      continue;
    }

    const supplierCost = formatMoney(money(mapping.unitCostAmount) * item.quantity);
    await db
      .update(orderItems)
      .set({ supplierCostAmount: supplierCost, updatedAt: new Date() })
      .where(eq(orderItems.id, item.id));
    updated += 1;
  }

  return updated;
}
