import { z } from "zod";

export const customisationModeSchema = z.enum(["none", "name", "number", "name_number", "message"]);
export type CustomisationMode = z.infer<typeof customisationModeSchema>;

export const cartCustomisationSchema = z
  .object({
    mode: customisationModeSchema.default("none"),
    name: z.string().trim().max(32).optional(),
    number: z.string().trim().max(8).optional(),
    message: z.string().trim().max(40).optional()
  })
  .superRefine((value, ctx) => {
    if ((value.mode === "name" || value.mode === "name_number") && !value.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is required", path: ["name"] });
    }

    if ((value.mode === "number" || value.mode === "name_number") && !value.number) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Number is required", path: ["number"] });
    }

    if (value.mode === "message" && !value.message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Message is required", path: ["message"] });
    }
  });
export type CartCustomisation = z.infer<typeof cartCustomisationSchema>;

/** Canonical production spec — uppercase names for supplier fulfilment. */
export function normalizeProductionCustomisation(input: CartCustomisation): CartCustomisation {
  const parsed = cartCustomisationSchema.parse(input);
  return {
    mode: parsed.mode,
    ...(parsed.name ? { name: parsed.name.trim().toUpperCase() } : {}),
    ...(parsed.number ? { number: parsed.number.trim() } : {}),
    ...(parsed.message ? { message: parsed.message.trim() } : {})
  };
}

export function formatProductionSpec(input: CartCustomisation): string {
  const c = normalizeProductionCustomisation(input);
  const parts: string[] = [];
  if (c.name) parts.push(`Name: ${c.name}`);
  if (c.number) parts.push(`Number: ${c.number}`);
  if (c.message) parts.push(`Message: ${c.message}`);
  return parts.length > 0 ? parts.join(" · ") : "Standard (no customisation)";
}

export const productFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1)
});
export type ProductFaq = z.infer<typeof productFaqSchema>;

export const sizeChartRowSchema = z
  .object({
    size: z.string().min(1)
  })
  .passthrough();
export type SizeChartRow = z.infer<typeof sizeChartRowSchema>;

export const sizeChartSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  sport: z.string().optional(),
  description: z.string().optional(),
  rows: z.array(sizeChartRowSchema).default([]),
  notes: z.string().optional()
});
export type SizeChart = z.infer<typeof sizeChartSchema>;

export const customisationProfileSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  allowedModes: z.array(customisationModeSchema).default(["none", "name", "number", "name_number"]),
  nameMaxLength: z.number().int().positive(),
  numberMaxLength: z.number().int().positive(),
  messageMaxLength: z.number().int().positive(),
  namePriceAmount: z.string(),
  numberPriceAmount: z.string(),
  nameNumberPriceAmount: z.string(),
  messagePriceAmount: z.string(),
  currencyCode: z.enum(["USD", "CAD"]).or(z.string().min(3)),
  requiresSize: z.boolean().default(true)
});
export type CustomisationProfile = z.infer<typeof customisationProfileSchema>;

export const orderStatusSchema = z.enum([
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
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const fulfilmentStatusSchema = z.enum([
  "unfulfilled",
  "awaiting_supplier",
  "submitted",
  "in_production",
  "shipped",
  "delivered",
  "cancelled"
]);
export type FulfilmentStatus = z.infer<typeof fulfilmentStatusSchema>;

export const issueReasonSchema = z.enum([
  "wrong_item",
  "manufacturing_defect",
  "damaged_in_transit",
  "lost_shipment",
  "missing_item",
  "supplier_error",
  "customer_issue",
  "goodwill_replacement"
]);
export type IssueReason = z.infer<typeof issueReasonSchema>;

export const issueStatusSchema = z.enum([
  "open",
  "investigating",
  "awaiting_customer",
  "awaiting_supplier",
  "approved",
  "rejected",
  "resolved",
  "closed"
]);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export function customisationPriceForMode(
  profile: Pick<
    CustomisationProfile,
    "namePriceAmount" | "numberPriceAmount" | "nameNumberPriceAmount" | "messagePriceAmount"
  >,
  mode: CustomisationMode
): string {
  switch (mode) {
    case "name":
      return profile.namePriceAmount;
    case "number":
      return profile.numberPriceAmount;
    case "name_number":
      return profile.nameNumberPriceAmount;
    case "message":
      return profile.messagePriceAmount;
    default:
      return "0.00";
  }
}

export function formatCustomisationSummary(customisation: CartCustomisation): string | null {
  switch (customisation.mode) {
    case "name":
      return customisation.name ? `Name: ${customisation.name}` : "Name customisation";
    case "number":
      return customisation.number ? `Number: ${customisation.number}` : "Number customisation";
    case "name_number":
      return [customisation.name ? `Name: ${customisation.name}` : null, customisation.number ? `#${customisation.number}` : null]
        .filter(Boolean)
        .join(" · ") || "Name + number";
    case "message":
      return customisation.message ? `Message: ${customisation.message}` : "Custom message";
    default:
      return null;
  }
}

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(1).max(20),
  country: z.enum(["US", "CA"]).default("US")
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const guestCheckoutSchema = z.object({
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(7).max(30),
  shippingAddress: shippingAddressSchema,
  customerNotes: z.string().trim().max(500).optional(),
  offerCode: z.string().trim().max(40).optional()
});
export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

export const abandonedCheckoutDraftSchema = z.object({
  email: z.string().trim().email().max(180).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  shippingAddress: shippingAddressSchema.partial().optional()
});
export type AbandonedCheckoutDraft = z.infer<typeof abandonedCheckoutDraftSchema>;
