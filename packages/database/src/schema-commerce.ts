import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { auditColumns, carts, customers, productVariants, products } from "./schema-catalogue";

export const customisationMode = pgEnum("customisation_mode", [
  "none",
  "name",
  "number",
  "name_number",
  "message"
]);

export const orderStatus = pgEnum("order_status", [
  "draft",
  "pending_payment",
  "paid",
  "processing",
  "submitted_to_supplier",
  "partially_shipped",
  "shipped",
  "delivered",
  "cancelled",
  "issue"
]);

export const fulfilmentStatus = pgEnum("fulfilment_status", [
  "unfulfilled",
  "awaiting_supplier",
  "submitted",
  "in_production",
  "shipped",
  "delivered",
  "cancelled"
]);

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "draft",
  "ready",
  "sent",
  "acknowledged",
  "fulfilled",
  "cancelled"
]);

export const issueReason = pgEnum("issue_reason", [
  "wrong_item",
  "manufacturing_defect",
  "damaged_in_transit",
  "lost_shipment",
  "missing_item",
  "supplier_error",
  "customer_issue",
  "goodwill_replacement"
]);

export const issueStatus = pgEnum("issue_status", [
  "open",
  "investigating",
  "awaiting_customer",
  "awaiting_supplier",
  "approved",
  "rejected",
  "resolved",
  "closed"
]);

export const leadCaptureSource = pgEnum("lead_capture_source", [
  "popup",
  "checkout",
  "footer",
  "abandoned_cart",
  "abandoned_checkout",
  "admin",
  "other"
]);

export const aiActionStatus = pgEnum("ai_action_status", [
  "preview",
  "pending_confirmation",
  "confirmed",
  "executed",
  "rejected",
  "failed"
]);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    packingSlipFormat: text("packing_slip_format").notNull().default("default_html"),
    courierNotes: text("courier_notes"),
    trackingNotes: text("tracking_notes"),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ...auditColumns
  },
  (table) => ({
    codeIdx: uniqueIndex("suppliers_code_idx").on(table.code)
  })
);

export const productSupplierMappings = pgTable(
  "product_supplier_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierSku: text("supplier_sku"),
    unitCostAmount: numeric("unit_cost_amount", { precision: 12, scale: 2 }),
    currencyCode: text("currency_code").notNull().default("USD"),
    isPrimary: boolean("is_primary").notNull().default(false),
    leadTimeDays: integer("lead_time_days"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ...auditColumns
  },
  (table) => ({
    productSupplierIdx: uniqueIndex("product_supplier_mappings_product_supplier_idx").on(
      table.productId,
      table.supplierId
    ),
    productIdx: index("product_supplier_mappings_product_id_idx").on(table.productId),
    supplierIdx: index("product_supplier_mappings_supplier_id_idx").on(table.supplierId)
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number")
      .notNull()
      .default(sql`'SJH-' || nextval('order_number_seq')`),
    customerId: uuid("customer_id").references(() => customers.id),
    email: text("email"),
    phone: text("phone"),
    status: orderStatus("status").notNull().default("draft"),
    fulfilmentStatus: fulfilmentStatus("fulfilment_status").notNull().default("unfulfilled"),
    currencyCode: text("currency_code").notNull().default("USD"),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    shippingRevenueAmount: numeric("shipping_revenue_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentFeeAmount: numeric("payment_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    shippingAddress: jsonb("shipping_address"),
    billingAddress: jsonb("billing_address"),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    paymentProvider: text("payment_provider"),
    paymentReference: text("payment_reference"),
    cartId: uuid("cart_id").references(() => carts.id),
    placedAt: timestamp("placed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...auditColumns
  },
  (table) => ({
    orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    customerIdx: index("orders_customer_id_idx").on(table.customerId),
    statusIdx: index("orders_status_idx").on(table.status),
    fulfilmentIdx: index("orders_fulfilment_status_idx").on(table.fulfilmentStatus),
    placedAtIdx: index("orders_placed_at_idx").on(table.placedAt)
  })
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poNumber: text("po_number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: purchaseOrderStatus("status").notNull().default("draft"),
    batchDate: date("batch_date"),
    packingSlipFormat: text("packing_slip_format"),
    packingSlipUrl: text("packing_slip_url"),
    packingSlipPayload: jsonb("packing_slip_payload"),
    emailTo: text("email_to"),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    notes: text("notes"),
    ...auditColumns
  },
  (table) => ({
    poNumberIdx: uniqueIndex("purchase_orders_po_number_idx").on(table.poNumber),
    supplierIdx: index("purchase_orders_supplier_id_idx").on(table.supplierId),
    batchDateIdx: index("purchase_orders_batch_date_idx").on(table.batchDate),
    statusIdx: index("purchase_orders_status_idx").on(table.status)
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    productTitle: text("product_title").notNull(),
    variantTitle: text("variant_title").notNull(),
    sku: text("sku"),
    sizeLabel: text("size_label"),
    quantity: integer("quantity").notNull().default(1),
    customisation: jsonb("customisation").notNull().default(sql`'{"mode":"none"}'::jsonb`),
    unitPriceAmount: numeric("unit_price_amount", { precision: 12, scale: 2 }).notNull(),
    customisationPriceAmount: numeric("customisation_price_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    lineTotalAmount: numeric("line_total_amount", { precision: 12, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull().default("USD"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id),
    fulfilmentStatus: fulfilmentStatus("fulfilment_status").notNull().default("unfulfilled"),
    trackingNumber: text("tracking_number"),
    courier: text("courier"),
    shippingDestination: jsonb("shipping_destination"),
    supplierCostAmount: numeric("supplier_cost_amount", { precision: 12, scale: 2 }),
    customisationCostAmount: numeric("customisation_cost_amount", { precision: 12, scale: 2 }),
    fulfilmentCostAmount: numeric("fulfilment_cost_amount", { precision: 12, scale: 2 }),
    otherCostAmount: numeric("other_cost_amount", { precision: 12, scale: 2 }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...auditColumns
  },
  (table) => ({
    orderIdx: index("order_items_order_id_idx").on(table.orderId),
    supplierIdx: index("order_items_supplier_id_idx").on(table.supplierId),
    fulfilmentIdx: index("order_items_fulfilment_status_idx").on(table.fulfilmentStatus),
    trackingIdx: index("order_items_tracking_number_idx").on(table.trackingNumber)
  })
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    quantity: integer("quantity").notNull().default(1),
    supplierSku: text("supplier_sku"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    poItemIdx: uniqueIndex("purchase_order_lines_po_item_idx").on(table.purchaseOrderId, table.orderItemId),
    poIdx: index("purchase_order_lines_po_id_idx").on(table.purchaseOrderId),
    orderItemIdx: index("purchase_order_lines_order_item_id_idx").on(table.orderItemId)
  })
);

export const courierRules = pgTable(
  "courier_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    pattern: text("pattern").notNull(),
    patternType: text("pattern_type").notNull().default("regex"),
    courierCode: text("courier_code").notNull(),
    courierName: text("courier_name").notNull(),
    priority: integer("priority").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...auditColumns
  },
  (table) => ({
    activePriorityIdx: index("courier_rules_active_priority_idx").on(table.isActive, table.priority)
  })
);

export const issueCases = pgTable(
  "issue_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseNumber: text("case_number").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    customerId: uuid("customer_id").references(() => customers.id),
    reason: issueReason("reason").notNull(),
    status: issueStatus("status").notNull().default("open"),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    internalNotes: text("internal_notes"),
    customerNotes: text("customer_notes"),
    decision: text("decision"),
    replacementOrderId: uuid("replacement_order_id").references(() => orders.id),
    replacementCostAmount: numeric("replacement_cost_amount", { precision: 12, scale: 2 }),
    supplierResponsibility: boolean("supplier_responsibility"),
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...auditColumns
  },
  (table) => ({
    caseNumberIdx: uniqueIndex("issue_cases_case_number_idx").on(table.caseNumber),
    orderIdx: index("issue_cases_order_id_idx").on(table.orderId),
    statusIdx: index("issue_cases_status_idx").on(table.status)
  })
);

export const marketingLeads = pgTable(
  "marketing_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    phone: text("phone"),
    source: leadCaptureSource("source").notNull().default("other"),
    offerCode: text("offer_code"),
    customerId: uuid("customer_id").references(() => customers.id),
    cartId: uuid("cart_id").references(() => carts.id),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sourceIdx: index("marketing_leads_source_idx").on(table.source)
  })
);

export const emailSubscribers = pgTable(
  "email_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    source: leadCaptureSource("source").notNull().default("other"),
    isActive: boolean("is_active").notNull().default(true),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    segments: text("segments")
      .array()
      .notNull()
      .default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("email_subscribers_email_idx").on(table.email)
  })
);

export const abandonedCheckouts = pgTable(
  "abandoned_checkouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").references(() => carts.id),
    customerId: uuid("customer_id").references(() => customers.id),
    email: text("email"),
    phone: text("phone"),
    checkoutPayload: jsonb("checkout_payload").notNull().default(sql`'{}'::jsonb`),
    recoveredOrderId: uuid("recovered_order_id").references(() => orders.id),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }).notNull().defaultNow(),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    abandonedAtIdx: index("abandoned_checkouts_abandoned_at_idx").on(table.abandonedAt)
  })
);

export const aiActionAudits = pgTable(
  "ai_action_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionType: text("action_type").notNull(),
    actor: text("actor").notNull().default("ai_ops"),
    status: aiActionStatus("status").notNull().default("preview"),
    inputPayload: jsonb("input_payload").notNull().default(sql`'{}'::jsonb`),
    previewPayload: jsonb("preview_payload"),
    resultPayload: jsonb("result_payload"),
    requiresConfirmation: boolean("requires_confirmation").notNull().default(true),
    confirmedBy: text("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("ai_action_audits_status_idx").on(table.status),
    actionTypeIdx: index("ai_action_audits_action_type_idx").on(table.actionType)
  })
);

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] })
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  supplier: one(suppliers, { fields: [orderItems.supplierId], references: [suppliers.id] }),
  purchaseOrder: one(purchaseOrders, {
    fields: [orderItems.purchaseOrderId],
    references: [purchaseOrders.id]
  })
}));
