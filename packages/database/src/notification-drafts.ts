/**
 * Notification event → draft architecture. No outbound send — preview only.
 */
export type NotificationEventType =
  | "supplier_new_order"
  | "supplier_ack_required"
  | "supplier_tracking_overdue"
  | "supplier_delivery_overdue"
  | "supplier_order_issue"
  | "supplier_replacement_request"
  | "supplier_order_update"
  | "customer_welcome"
  | "customer_abandoned_cart"
  | "customer_abandoned_checkout"
  | "customer_order_confirmation"
  | "customer_tracking"
  | "customer_delivery"
  | "customer_issue"
  | "customer_replacement"
  | "customer_review_request"
  | "customer_winback"
  | "customer_promotional";

export type NotificationDraft = {
  eventType: NotificationEventType;
  audience: "supplier" | "customer" | "admin";
  to: string | null;
  subject: string;
  bodyText: string;
  metadata: Record<string, unknown>;
  sendEnabled: false;
};

export function buildSupplierNewOrderDraft(input: {
  poNumber: string;
  supplierName: string;
  supplierEmail: string | null;
  lineCount: number;
  batchDate: string;
}): NotificationDraft {
  return {
    eventType: "supplier_new_order",
    audience: "supplier",
    to: input.supplierEmail,
    subject: `New purchase order ${input.poNumber} — Sports Jersey House`,
    bodyText: [
      `Hello ${input.supplierName},`,
      "",
      `A new purchase order (${input.poNumber}) with ${input.lineCount} line(s) is ready for fulfilment.`,
      `Batch date: ${input.batchDate}.`,
      "",
      "Please log in to the supplier portal to acknowledge and begin production.",
      "",
      "[DRAFT — not sent automatically]",
      "",
      "Sports Jersey House Ops"
    ].join("\n"),
    metadata: { poNumber: input.poNumber, lineCount: input.lineCount },
    sendEnabled: false
  };
}

export function buildSupplierTrackingOverdueDraft(input: {
  poNumber: string;
  supplierEmail: string | null;
  daysOverdue: number;
}): NotificationDraft {
  return {
    eventType: "supplier_tracking_overdue",
    audience: "supplier",
    to: input.supplierEmail,
    subject: `Tracking overdue — PO ${input.poNumber}`,
    bodyText: [
      `Purchase order ${input.poNumber} was acknowledged over ${input.daysOverdue} days ago without tracking.`,
      "",
      "Please submit tracking in the supplier portal.",
      "",
      "[DRAFT — not sent automatically]"
    ].join("\n"),
    metadata: { poNumber: input.poNumber, daysOverdue: input.daysOverdue },
    sendEnabled: false
  };
}

export function buildCustomerOrderConfirmationDraft(input: {
  email: string;
  orderNumber: string;
  totalAmount: string;
  currencyCode: string;
  lines: Array<{ title: string; size: string; quantity: number; customisation: string }>;
}): NotificationDraft {
  const lineText = input.lines
    .map(
      (l) =>
        `- ${l.title} (${l.size}) × ${l.quantity}${l.customisation !== "Standard (no customisation)" ? ` — ${l.customisation}` : ""}`
    )
    .join("\n");

  return {
    eventType: "customer_order_confirmation",
    audience: "customer",
    to: input.email,
    subject: `Order confirmed — ${input.orderNumber}`,
    bodyText: [
      "Thank you for your order at Sports Jersey House.",
      "",
      `Order: ${input.orderNumber}`,
      `Total: ${input.currencyCode} ${input.totalAmount}`,
      "",
      "Items:",
      lineText,
      "",
      "Made-to-order jerseys are produced after you order. We'll share tracking when dispatched.",
      "",
      "[DRAFT — not sent automatically]"
    ].join("\n"),
    metadata: { orderNumber: input.orderNumber },
    sendEnabled: false
  };
}

export function listNotificationEventTypes(): NotificationEventType[] {
  return [
    "supplier_new_order",
    "supplier_ack_required",
    "supplier_tracking_overdue",
    "supplier_delivery_overdue",
    "supplier_order_issue",
    "supplier_replacement_request",
    "supplier_order_update",
    "customer_welcome",
    "customer_abandoned_cart",
    "customer_abandoned_checkout",
    "customer_order_confirmation",
    "customer_tracking",
    "customer_delivery",
    "customer_issue",
    "customer_replacement",
    "customer_review_request",
    "customer_winback",
    "customer_promotional"
  ];
}
