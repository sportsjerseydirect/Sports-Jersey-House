import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AbandonedCheckoutDraft, CartCustomisation, GuestCheckoutInput, SelectedProductOptions } from "@sjh/shared";
import {
  cartCustomisationSchema,
  formatSelectedOptionsSummary,
  normalizeProductionCustomisation,
  normalizeProductionSelectedOptions
} from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { getCartBySessionId } from "./cart";
import { resolveCartCustomisationPricing, resolveCartLineOptions } from "./cart-customisation";
import { applyOfferToAmounts, evaluateWelcome10Eligibility } from "./offers";
import { cartItems, carts, customers } from "./schema-catalogue";
import { abandonedCheckouts, orderItems, orders, productSupplierMappings } from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for order operations.");
  }
  return url;
}

export type OrderLineSnapshot = {
  id: string;
  productTitle: string;
  variantTitle: string;
  sku?: string;
  sizeLabel?: string;
  colourLabel?: string | null;
  quantity: number;
  customisation: CartCustomisation;
  selectedOptions?: SelectedProductOptions | null;
  optionsSummary?: string[];
  unitPriceAmount: string;
  customisationPriceAmount: string;
  lineTotalAmount: string;
  currencyCode: string;
  fulfilmentStatus: string;
  trackingNumber: string | null;
  courier: string | null;
  shippedAt: Date | null;
};

export type OrderSnapshot = {
  id: string;
  orderNumber: string;
  email: string | null;
  phone: string | null;
  status: string;
  fulfilmentStatus: string;
  currencyCode: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingRevenueAmount: string;
  taxAmount: string;
  totalAmount: string;
  shippingAddress: GuestCheckoutInput["shippingAddress"] | null;
  customerNotes: string | null;
  placedAt: Date | null;
  items: OrderLineSnapshot[];
};

export async function clearCart(sessionId: string, databaseUrl?: string): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.sessionId, sessionId)).limit(1);

  if (!cart) {
    return;
  }

  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
}

async function findOrCreateCustomer(
  db: ReturnType<typeof createDatabaseClient>,
  input: GuestCheckoutInput
): Promise<string> {
  const email = input.email.toLowerCase();
  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(sql`lower(${customers.email}) = ${email}`, isNull(customers.deletedAt)))
    .limit(1);

  if (existing) {
    await db
      .update(customers)
      .set({
        phone: input.phone,
        firstName: input.shippingAddress.fullName.split(" ")[0] ?? null,
        lastName: input.shippingAddress.fullName.split(" ").slice(1).join(" ") || null,
        updatedAt: new Date()
      })
      .where(eq(customers.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(customers)
    .values({
      email,
      phone: input.phone,
      firstName: input.shippingAddress.fullName.split(" ")[0] ?? null,
      lastName: input.shippingAddress.fullName.split(" ").slice(1).join(" ") || null
    })
    .returning({ id: customers.id });

  if (!created) {
    throw new Error("Failed to create customer.");
  }

  return created.id;
}

export async function createOrderFromCart(
  sessionId: string,
  input: GuestCheckoutInput,
  databaseUrl?: string
): Promise<OrderSnapshot> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const cart = await getCartBySessionId(sessionId, url);

  if (!cart.id || cart.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  // Re-validate options + pricing at checkout — never trust stale cart snapshots.
  const validatedLines: Array<
    (typeof cart.items)[number] & {
      selectedOptions: SelectedProductOptions | null;
      colourLabel: string | null;
      shopifyProductId?: string | null;
      shopifyVariantId?: string | null;
    }
  > = [];
  for (const item of cart.items) {
    if (item.selectedOptions) {
      const resolved = await resolveCartLineOptions(item.variantId, item.selectedOptions, url);
      const selected = normalizeProductionSelectedOptions(resolved.selectedOptions!);
      const customisation = normalizeProductionCustomisation(resolved.customisation);
      const unitTotal = (
        Number.parseFloat(item.priceAmount) + Number.parseFloat(resolved.customisationPriceAmount)
      ).toFixed(2);
      validatedLines.push({
        ...item,
        customisation,
        customisationPriceAmount: resolved.customisationPriceAmount,
        selectedOptions: selected,
        sizeLabel: selected.size,
        colourLabel: selected.colour ?? null,
        shopifyProductId: resolved.shopifyProductId ?? null,
        shopifyVariantId: resolved.shopifyVariantId ?? null,
        lineTotalAmount: (Number.parseFloat(unitTotal) * item.quantity).toFixed(2)
      });
    } else {
      const resolved = await resolveCartCustomisationPricing(item.variantId, item.customisation, url);
      const customisation = normalizeProductionCustomisation(resolved.customisation);
      const unitTotal = (
        Number.parseFloat(item.priceAmount) + Number.parseFloat(resolved.customisationPriceAmount)
      ).toFixed(2);
      validatedLines.push({
        ...item,
        customisation,
        customisationPriceAmount: resolved.customisationPriceAmount,
        selectedOptions: item.selectedOptions,
        colourLabel: item.colourLabel,
        lineTotalAmount: (Number.parseFloat(unitTotal) * item.quantity).toFixed(2)
      });
    }
  }

  const cartSubtotal = validatedLines
    .reduce((sum, item) => sum + Number.parseFloat(item.lineTotalAmount), 0)
    .toFixed(2);

  const currencies = new Set(validatedLines.map((item) => item.currencyCode.toUpperCase()));
  if (currencies.size !== 1) {
    throw new Error("Cart contains mixed currencies. Remove items so all lines share one currency.");
  }
  const orderCurrency = [...currencies][0]!;

  const customerId = await findOrCreateCustomer(db, input);
  const now = new Date();

  const offerCode = input.offerCode?.trim().toUpperCase() || null;
  let discountAmount = "0.00";
  let totalAmount = cartSubtotal;
  let internalNotes: string | null = null;

  if (offerCode === "WELCOME10") {
    const eligibility = await evaluateWelcome10Eligibility({ email: input.email }, url);
    if (!eligibility.eligible || !eligibility.offer) {
      throw new Error(
        eligibility.reasons[0] ?? "WELCOME10 is not available for this checkout."
      );
    }
    const applied = applyOfferToAmounts(cartSubtotal, eligibility.offer);
    discountAmount = applied.discountAmount;
    totalAmount = applied.totalAfterDiscount;
    internalNotes = `Applied offer ${offerCode} (${eligibility.offer.percentOff ?? "0"}% off).`;
  } else if (offerCode) {
    throw new Error(`Unknown offer code: ${offerCode}`);
  }

  const [order] = await db
    .insert(orders)
    .values({
      customerId,
      email: input.email.toLowerCase(),
      phone: input.phone,
      status: "pending_payment",
      fulfilmentStatus: "unfulfilled",
      currencyCode: orderCurrency,
      subtotalAmount: cartSubtotal,
      discountAmount,
      shippingRevenueAmount: "0.00",
      taxAmount: "0.00",
      paymentFeeAmount: "0.00",
      totalAmount,
      shippingAddress: input.shippingAddress,
      billingAddress: input.shippingAddress,
      customerNotes: input.customerNotes ?? null,
      internalNotes,
      cartId: cart.id,
      placedAt: now
    })
    .returning();

  if (!order) {
    throw new Error("Failed to create order.");
  }

  const productIds = [...new Set(validatedLines.map((item) => item.productId))];
  const mappings =
    productIds.length > 0
      ? await db
          .select({
            productId: productSupplierMappings.productId,
            supplierId: productSupplierMappings.supplierId
          })
          .from(productSupplierMappings)
          .where(
            and(
              inArray(productSupplierMappings.productId, productIds),
              eq(productSupplierMappings.isPrimary, true),
              isNull(productSupplierMappings.deletedAt)
            )
          )
      : [];

  const supplierByProduct = new Map(mappings.map((row) => [row.productId, row.supplierId]));

  await db.insert(orderItems).values(
    validatedLines.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      sku: item.sku,
      sizeLabel: item.selectedOptions?.size ?? item.sizeLabel ?? null,
      colourLabel: item.selectedOptions?.colour ?? item.colourLabel ?? null,
      selectedOptions: item.selectedOptions,
      shopifyProductId: item.shopifyProductId ?? null,
      shopifyVariantId: item.shopifyVariantId ?? null,
      storefront: "sjh",
      quantity: item.quantity,
      customisation: item.customisation,
      unitPriceAmount: item.priceAmount,
      customisationPriceAmount: item.customisationPriceAmount,
      discountAmount: "0.00",
      lineTotalAmount: item.lineTotalAmount,
      currencyCode: item.currencyCode,
      fulfilmentStatus: "unfulfilled" as const,
      shippingDestination: input.shippingAddress,
      supplierId: supplierByProduct.get(item.productId) ?? null
    }))
  );

  await db
    .update(abandonedCheckouts)
    .set({
      recoveredOrderId: order.id,
      recoveredAt: now,
      updatedAt: now
    })
    .where(and(eq(abandonedCheckouts.cartId, cart.id), isNull(abandonedCheckouts.recoveredAt)));

  await clearCart(sessionId, url);

  const snapshot = await getOrderByNumber(order.orderNumber, url);
  if (!snapshot) {
    throw new Error("Order created but could not be reloaded.");
  }

  return snapshot;
}

export async function recordAbandonedCheckout(
  sessionId: string,
  draft: AbandonedCheckoutDraft,
  databaseUrl?: string
): Promise<void> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const cart = await getCartBySessionId(sessionId, url);

  if (!cart.id) {
    return;
  }

  const [existing] = await db
    .select({ id: abandonedCheckouts.id })
    .from(abandonedCheckouts)
    .where(and(eq(abandonedCheckouts.cartId, cart.id), isNull(abandonedCheckouts.recoveredAt)))
    .limit(1);

  const payload = {
    email: draft.email?.toLowerCase() ?? null,
    phone: draft.phone ?? null,
    shippingAddress: draft.shippingAddress ?? null,
    itemCount: cart.itemCount,
    subtotalAmount: cart.subtotalAmount,
    lines: cart.items.map((item) => ({
      productTitle: item.productTitle,
      sizeLabel: item.sizeLabel ?? item.variantTitle,
      colourLabel: item.colourLabel,
      quantity: item.quantity,
      customisation: item.customisation,
      selectedOptions: item.selectedOptions,
      optionsSummary: item.optionsSummary
    }))
  };

  if (existing) {
    await db
      .update(abandonedCheckouts)
      .set({
        email: draft.email?.toLowerCase() ?? null,
        phone: draft.phone ?? null,
        checkoutPayload: payload,
        updatedAt: new Date()
      })
      .where(eq(abandonedCheckouts.id, existing.id));
    return;
  }

  await db.insert(abandonedCheckouts).values({
    cartId: cart.id,
    email: draft.email?.toLowerCase() ?? null,
    phone: draft.phone ?? null,
    checkoutPayload: payload
  });
}

function mapOrderRow(
  order: typeof orders.$inferSelect,
  items: Array<typeof orderItems.$inferSelect>
): OrderSnapshot {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    phone: order.phone,
    status: order.status,
    fulfilmentStatus: order.fulfilmentStatus,
    currencyCode: order.currencyCode,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    shippingRevenueAmount: order.shippingRevenueAmount,
    taxAmount: order.taxAmount,
    totalAmount: order.totalAmount,
    shippingAddress: (order.shippingAddress as GuestCheckoutInput["shippingAddress"] | null) ?? null,
    customerNotes: order.customerNotes,
    placedAt: order.placedAt,
    items: items.map((item) => {
      const customisation = cartCustomisationSchema.parse(item.customisation ?? { mode: "none" });
      const selectedOptions = item.selectedOptions
        ? (item.selectedOptions as SelectedProductOptions)
        : null;
      return {
        id: item.id,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        ...(item.sku ? { sku: item.sku } : {}),
        ...(item.sizeLabel ? { sizeLabel: item.sizeLabel } : {}),
        colourLabel: item.colourLabel ?? selectedOptions?.colour ?? null,
        quantity: item.quantity,
        customisation,
        selectedOptions,
        ...(selectedOptions
          ? { optionsSummary: formatSelectedOptionsSummary(selectedOptions) }
          : {}),
        unitPriceAmount: item.unitPriceAmount,
        customisationPriceAmount: item.customisationPriceAmount,
        lineTotalAmount: item.lineTotalAmount,
        currencyCode: item.currencyCode,
        fulfilmentStatus: item.fulfilmentStatus,
        trackingNumber: item.trackingNumber,
        courier: item.courier,
        shippedAt: item.shippedAt
      };
    })
  };
}

export async function getOrderByNumber(
  orderNumber: string,
  databaseUrl?: string
): Promise<OrderSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);

  if (!order || order.deletedAt) {
    return null;
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.deletedAt)));

  return mapOrderRow(order, items);
}

export async function listOrders(limit = 50, databaseUrl?: string): Promise<OrderSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(orders)
    .where(isNull(orders.deletedAt))
    .orderBy(desc(orders.placedAt), desc(orders.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    return [];
  }

  const orderIds = rows.map((row) => row.id);
  const items = await db
    .select()
    .from(orderItems)
    .where(and(inArray(orderItems.orderId, orderIds), isNull(orderItems.deletedAt)));

  return rows.map((order) => mapOrderRow(order, items.filter((item) => item.orderId === order.id)));
}
