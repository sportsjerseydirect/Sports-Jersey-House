import { and, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { orders, stripeWebhookEvents } from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for payment operations.");
  }
  return url;
}

export function amountToStripeCents(amount: string): number {
  const normalized = amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money amount for Stripe: ${amount}`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents =
    Number.parseInt(whole ?? "0", 10) * 100 + Number.parseInt((fraction + "00").slice(0, 2), 10);
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error(`Invalid Stripe cent amount derived from ${amount}`);
  }
  return cents;
}

export function stripeFeeToDecimal(feeCents: number | null | undefined): string {
  if (feeCents === null || feeCents === undefined || !Number.isFinite(feeCents) || feeCents < 0) {
    return "0.00";
  }
  return (feeCents / 100).toFixed(2);
}

export type AttachCheckoutSessionInput = {
  orderId: string;
  checkoutSessionId: string;
};

export async function attachStripeCheckoutSession(
  input: AttachCheckoutSessionInput,
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [updated] = await db
    .update(orders)
    .set({
      paymentProvider: "stripe",
      paymentReference: input.checkoutSessionId,
      stripeCheckoutSessionId: input.checkoutSessionId,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.status, "pending_payment"),
        isNull(orders.deletedAt)
      )
    )
    .returning({ id: orders.id });

  if (!updated) {
    throw new Error("Unable to attach Stripe Checkout Session to pending order.");
  }
}

export type MarkOrderPaidFromStripeInput = {
  eventId: string;
  eventType: string;
  livemode: boolean;
  orderId?: string | null;
  orderNumber?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  paymentFeeAmount?: string | null;
  expectedAmountCents?: number | null;
  expectedCurrency?: string | null;
};

export type MarkOrderPaidFromStripeResult = {
  duplicateEvent: boolean;
  orderId: string | null;
  orderNumber: string | null;
  alreadyPaid: boolean;
  newlyPaid: boolean;
};

export async function beginStripeWebhookEvent(
  input: {
    eventId: string;
    eventType: string;
    livemode: boolean;
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
  },
  databaseUrl?: string
): Promise<{ duplicate: boolean }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [existing] = await db
    .select({ id: stripeWebhookEvents.id })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.id, input.eventId))
    .limit(1);

  if (existing) {
    return { duplicate: true };
  }

  try {
    await db.insert(stripeWebhookEvents).values({
      id: input.eventId,
      eventType: input.eventType,
      livemode: input.livemode,
      stripeCheckoutSessionId: input.checkoutSessionId ?? null,
      stripePaymentIntentId: input.paymentIntentId ?? null,
      processingStatus: "received",
      receivedAt: new Date()
    });
    return { duplicate: false };
  } catch {
    // Unique conflict under concurrent delivery.
    return { duplicate: true };
  }
}

export async function markOrderPaidFromStripe(
  input: MarkOrderPaidFromStripeInput,
  databaseUrl?: string
): Promise<MarkOrderPaidFromStripeResult> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const now = new Date();

  const started = await beginStripeWebhookEvent(
    {
      eventId: input.eventId,
      eventType: input.eventType,
      livemode: input.livemode,
      ...(input.checkoutSessionId != null ? { checkoutSessionId: input.checkoutSessionId } : {}),
      ...(input.paymentIntentId != null ? { paymentIntentId: input.paymentIntentId } : {})
    },
    url
  );

  if (started.duplicate) {
    const [existingOrder] = input.checkoutSessionId
      ? await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status
          })
          .from(orders)
          .where(eq(orders.stripeCheckoutSessionId, input.checkoutSessionId))
          .limit(1)
      : [];

    return {
      duplicateEvent: true,
      orderId: existingOrder?.id ?? null,
      orderNumber: existingOrder?.orderNumber ?? null,
      alreadyPaid: existingOrder?.status === "paid",
      newlyPaid: false
    };
  }

  if (input.livemode) {
    await db
      .update(stripeWebhookEvents)
      .set({
        processingStatus: "rejected_livemode",
        errorMessage: "Live-mode Stripe events are rejected. TEST MODE only.",
        processedAt: now,
        updatedAt: now
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));
    throw new Error("Live-mode Stripe webhook rejected. TEST MODE only.");
  }

  let orderRow:
    | {
        id: string;
        orderNumber: string;
        status: string;
        totalAmount: string;
        currencyCode: string;
        paidAt: Date | null;
        stripePaymentIntentId: string | null;
      }
    | undefined;

  if (input.orderId) {
    const [row] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currencyCode: orders.currencyCode,
        paidAt: orders.paidAt,
        stripePaymentIntentId: orders.stripePaymentIntentId
      })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), isNull(orders.deletedAt)))
      .limit(1);
    orderRow = row;
  }

  if (!orderRow && input.checkoutSessionId) {
    const [row] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currencyCode: orders.currencyCode,
        paidAt: orders.paidAt,
        stripePaymentIntentId: orders.stripePaymentIntentId
      })
      .from(orders)
      .where(
        and(eq(orders.stripeCheckoutSessionId, input.checkoutSessionId), isNull(orders.deletedAt))
      )
      .limit(1);
    orderRow = row;
  }

  if (!orderRow && input.orderNumber) {
    const [row] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currencyCode: orders.currencyCode,
        paidAt: orders.paidAt,
        stripePaymentIntentId: orders.stripePaymentIntentId
      })
      .from(orders)
      .where(and(eq(orders.orderNumber, input.orderNumber), isNull(orders.deletedAt)))
      .limit(1);
    orderRow = row;
  }

  if (!orderRow) {
    await db
      .update(stripeWebhookEvents)
      .set({
        processingStatus: "order_not_found",
        errorMessage: "No SJH order matched this Stripe payment event.",
        processedAt: now,
        updatedAt: now
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));
    throw new Error("No SJH order matched this Stripe payment event.");
  }

  if (
    input.expectedAmountCents !== null &&
    input.expectedAmountCents !== undefined &&
    amountToStripeCents(orderRow.totalAmount) !== input.expectedAmountCents
  ) {
    await db
      .update(stripeWebhookEvents)
      .set({
        orderId: orderRow.id,
        processingStatus: "amount_mismatch",
        errorMessage: `Stripe amount ${input.expectedAmountCents} does not match order total ${orderRow.totalAmount}.`,
        processedAt: now,
        updatedAt: now
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));
    throw new Error("Stripe payment amount does not match SJH order total.");
  }

  if (
    input.expectedCurrency &&
    input.expectedCurrency.toUpperCase() !== orderRow.currencyCode.toUpperCase()
  ) {
    await db
      .update(stripeWebhookEvents)
      .set({
        orderId: orderRow.id,
        processingStatus: "currency_mismatch",
        errorMessage: `Stripe currency ${input.expectedCurrency} does not match order currency ${orderRow.currencyCode}.`,
        processedAt: now,
        updatedAt: now
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));
    throw new Error("Stripe payment currency does not match SJH order currency.");
  }

  if (orderRow.status === "paid") {
    await db
      .update(stripeWebhookEvents)
      .set({
        orderId: orderRow.id,
        processingStatus: "already_paid",
        processedAt: now,
        updatedAt: now,
        stripePaymentIntentId: input.paymentIntentId ?? orderRow.stripePaymentIntentId
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));

    return {
      duplicateEvent: false,
      orderId: orderRow.id,
      orderNumber: orderRow.orderNumber,
      alreadyPaid: true,
      newlyPaid: false
    };
  }

  if (orderRow.status !== "pending_payment") {
    await db
      .update(stripeWebhookEvents)
      .set({
        orderId: orderRow.id,
        processingStatus: "invalid_status",
        errorMessage: `Order status ${orderRow.status} cannot transition to paid from Stripe.`,
        processedAt: now,
        updatedAt: now
      })
      .where(eq(stripeWebhookEvents.id, input.eventId));
    throw new Error(`Order ${orderRow.orderNumber} is not pending_payment.`);
  }

  const [paid] = await db
    .update(orders)
    .set({
      status: "paid",
      paymentProvider: "stripe",
      paymentReference: input.paymentIntentId ?? input.checkoutSessionId ?? orderRow.orderNumber,
      stripeCheckoutSessionId: input.checkoutSessionId ?? undefined,
      stripePaymentIntentId: input.paymentIntentId ?? undefined,
      paymentFeeAmount: input.paymentFeeAmount ?? undefined,
      paidAt: now,
      updatedAt: now
    })
    .where(and(eq(orders.id, orderRow.id), eq(orders.status, "pending_payment")))
    .returning({
      id: orders.id,
      orderNumber: orders.orderNumber
    });

  await db
    .update(stripeWebhookEvents)
    .set({
      orderId: orderRow.id,
      processingStatus: paid ? "processed" : "race_already_paid",
      processedAt: now,
      updatedAt: now,
      stripeCheckoutSessionId: input.checkoutSessionId ?? null,
      stripePaymentIntentId: input.paymentIntentId ?? null
    })
    .where(eq(stripeWebhookEvents.id, input.eventId));

  return {
    duplicateEvent: false,
    orderId: paid?.id ?? orderRow.id,
    orderNumber: paid?.orderNumber ?? orderRow.orderNumber,
    alreadyPaid: !paid,
    newlyPaid: Boolean(paid)
  };
}

export async function recordStripePaymentFailure(
  input: {
    eventId: string;
    eventType: string;
    livemode: boolean;
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
    orderId?: string | null;
    orderNumber?: string | null;
  },
  databaseUrl?: string
): Promise<{ duplicateEvent: boolean; orderNumber: string | null }> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const started = await beginStripeWebhookEvent(
    {
      eventId: input.eventId,
      eventType: input.eventType,
      livemode: input.livemode,
      ...(input.checkoutSessionId != null ? { checkoutSessionId: input.checkoutSessionId } : {}),
      ...(input.paymentIntentId != null ? { paymentIntentId: input.paymentIntentId } : {})
    },
    url
  );

  if (started.duplicate) {
    return { duplicateEvent: true, orderNumber: input.orderNumber ?? null };
  }

  let orderId = input.orderId ?? null;
  let orderNumber = input.orderNumber ?? null;

  if (!orderId && input.checkoutSessionId) {
    const [row] = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
      .from(orders)
      .where(eq(orders.stripeCheckoutSessionId, input.checkoutSessionId))
      .limit(1);
    orderId = row?.id ?? null;
    orderNumber = row?.orderNumber ?? null;
    // Intentionally leave pending_payment unpaid — no PO path.
    if (row && row.status === "pending_payment") {
      await db
        .update(orders)
        .set({
          internalNotes: sql`trim(both from coalesce(${orders.internalNotes}, '') || ' Stripe payment failed/async failed; remains pending_payment.')`,
          updatedAt: new Date()
        })
        .where(eq(orders.id, row.id));
    }
  }

  await db
    .update(stripeWebhookEvents)
    .set({
      orderId,
      processingStatus: "payment_failed",
      processedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(stripeWebhookEvents.id, input.eventId));

  return { duplicateEvent: false, orderNumber };
}

export async function getOrderPaymentState(
  orderNumber: string,
  databaseUrl?: string
): Promise<{
  id: string;
  orderNumber: string;
  status: string;
  currencyCode: string;
  totalAmount: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paymentFeeAmount: string;
  paidAt: Date | null;
} | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      currencyCode: orders.currencyCode,
      totalAmount: orders.totalAmount,
      paymentProvider: orders.paymentProvider,
      paymentReference: orders.paymentReference,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      paymentFeeAmount: orders.paymentFeeAmount,
      paidAt: orders.paidAt
    })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)))
    .limit(1);

  return row ?? null;
}
