/**
 * Storefront-agnostic product options model.
 * Mirrors SJD Aris Product Options (AvisPlus) semantics without coupling to Shopify variants.
 *
 * Axes:
 * - Merchandising variant (colour / Default Title) — Shopify variant equivalent
 * - Size — first-class option (NOT a Shopify variant)
 * - Customisation — Yes/No + optional name/number/message
 */
import { z } from "zod";
import type { CartCustomisation } from "./commerce";
import { cartCustomisationSchema } from "./commerce";

/** SJD Aris flat customisation surcharge when Customization = Yes. */
export const SJD_CUSTOMISATION_PRICE_AMOUNT = "4.99";

/**
 * Size values observed on live SJD Aris optionsets (Aug 2026).
 * Do not invent values beyond these confirmed lists.
 */
export const SIZE_OPTION_SETS = {
  "baseball-jerseys": {
    slug: "baseball-jerseys",
    title: "Baseball jerseys",
    sport: "Baseball",
    sizes: [
      "XS/Men's",
      "S/Men's",
      "M/Men's",
      "L/Men's",
      "XL/Men's",
      "2XL/Men's",
      "3XL/Men's",
      "S/Women's",
      "M/Women's",
      "L/Women's",
      "XL/Women's",
      "Youth S",
      "Youth M",
      "Youth L",
      "Youth XL",
      "1T (1–2 yrs)",
      "2T (2–3 yrs)",
      "3T (3–4 yrs)",
      "4T (4–5 yrs)",
      "5T (5–6 yrs)",
      "6T (6–7 yrs)"
    ]
  },
  "hockey-jerseys": {
    slug: "hockey-jerseys",
    title: "Hockey jerseys",
    sport: "Hockey",
    sizes: [
      "S/Men's",
      "M/Men's",
      "L/Men's",
      "XL/Men's",
      "2XL/Men's",
      "3XL/Men's",
      "Youth/S",
      "Youth/M",
      "Youth/L",
      "Youth/XL"
    ]
  },
  "soccer-jerseys": {
    slug: "soccer-jerseys",
    title: "Soccer jerseys",
    sport: "Soccer",
    sizes: [
      "S/Men's",
      "M/Men's",
      "L/Men's",
      "XL/Men's",
      "2XL/Men's",
      "Youth/XS",
      "Youth/S",
      "Youth/M",
      "Youth/L",
      "Youth/XL"
    ]
  }
} as const;

export type SizeOptionSetSlug = keyof typeof SIZE_OPTION_SETS;

export const sizeOptionSetSlugSchema = z.enum([
  "baseball-jerseys",
  "hockey-jerseys",
  "soccer-jerseys"
]);

export const sizeOptionSetSchema = z.object({
  slug: sizeOptionSetSlugSchema,
  title: z.string().min(1),
  sport: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1)
});
export type SizeOptionSet = z.infer<typeof sizeOptionSetSchema>;

export function getSizeOptionSet(slug: string): SizeOptionSet | null {
  if (!(slug in SIZE_OPTION_SETS)) return null;
  const set = SIZE_OPTION_SETS[slug as SizeOptionSetSlug];
  return {
    slug: set.slug,
    title: set.title,
    sport: set.sport,
    sizes: [...set.sizes]
  };
}

/** Map catalogue sport → confirmed Aris size optionset. Unmapped sports = review. */
export function sizeOptionSetSlugForSport(sport: string | null | undefined): SizeOptionSetSlug | null {
  if (!sport) return null;
  const key = sport.trim().toLowerCase();
  if (key === "baseball") return "baseball-jerseys";
  if (key === "hockey") return "hockey-jerseys";
  if (key === "soccer") return "soccer-jerseys";
  return null;
}

export const selectedCustomisationSchema = z
  .object({
    enabled: z.boolean().default(false),
    name: z.string().trim().max(32).optional(),
    number: z.string().trim().max(8).optional(),
    message: z.string().trim().max(40).optional()
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    // SJD allows Yes with empty fields; name/number/message are optional when enabled.
    if (value.name && value.name.length > 32) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name is too long", path: ["name"] });
    }
  });
export type SelectedCustomisation = z.infer<typeof selectedCustomisationSchema>;

export const selectedProductOptionsSchema = z.object({
  colour: z.string().trim().max(80).nullable().optional(),
  size: z.string().trim().min(1).max(80),
  customisation: selectedCustomisationSchema.default({ enabled: false }),
  optionSetSlug: sizeOptionSetSlugSchema.optional()
});
export type SelectedProductOptions = z.infer<typeof selectedProductOptionsSchema>;

export const productOptionsSummarySchema = z.object({
  optionSet: sizeOptionSetSchema.nullable(),
  requiresSize: z.boolean(),
  customisationEnabled: z.boolean(),
  customisationPriceAmount: z.string(),
  variantAxis: z.enum(["colour", "title", "size", "unknown"])
});
export type ProductOptionsSummary = z.infer<typeof productOptionsSummarySchema>;

/** Infer colour label from Shopify-style variant options — never treat as size. */
export function colourFromVariantOptions(
  options: Record<string, string> | null | undefined,
  variantTitle: string
): string | null {
  if (options) {
    const color = options.Color ?? options.color ?? options.Colour ?? options.colour;
    if (color && color.trim() && color.trim().toLowerCase() !== "default title") {
      return color.trim();
    }
  }
  const title = variantTitle.trim();
  if (!title || title.toLowerCase() === "default title") return null;
  // Color-titled variants (White, Cream, …) — title is colour, not size.
  if (options && (options.Color || options.color || options.Colour || options.colour)) {
    return title;
  }
  // Single Default Title axis — no colour.
  if (options && (options.Title || options.title) && Object.keys(options).length === 1) {
    return null;
  }
  return title;
}

export function variantAxisFromOptions(
  options: Record<string, string> | null | undefined
): ProductOptionsSummary["variantAxis"] {
  if (!options || Object.keys(options).length === 0) return "unknown";
  if (options.Color || options.color || options.Colour || options.colour) return "colour";
  if (options.Size || options.size) return "size";
  if (options.Title || options.title) return "title";
  return "unknown";
}

/** Convert SJD-style selected options → legacy CartCustomisation for existing columns. */
export function selectedOptionsToCartCustomisation(
  options: SelectedProductOptions
): CartCustomisation {
  const c = options.customisation;
  if (!c.enabled) {
    return { mode: "none" };
  }
  return cartCustomisationSchema.parse({
    mode: "custom",
    ...(c.name?.trim() ? { name: c.name.trim() } : {}),
    ...(c.number?.trim() ? { number: c.number.trim() } : {}),
    ...(c.message?.trim() ? { message: c.message.trim() } : {})
  });
}

/** Best-effort reverse map for reading older cart/order rows. */
export function cartCustomisationToSelected(
  customisation: CartCustomisation,
  size: string,
  colour?: string | null
): SelectedProductOptions {
  const enabled = customisation.mode !== "none";
  return selectedProductOptionsSchema.parse({
    colour: colour ?? null,
    size,
    customisation: {
      enabled,
      ...(customisation.name ? { name: customisation.name } : {}),
      ...(customisation.number ? { number: customisation.number } : {}),
      ...(customisation.message ? { message: customisation.message } : {})
    }
  });
}

/** Prefer structured selected_options; fall back to legacy customisation + size_label. */
export function resolveLineSelectedOptions(input: {
  selectedOptions?: unknown;
  customisation?: unknown;
  sizeLabel?: string | null;
  variantTitle?: string | null;
  colour?: string | null;
}): SelectedProductOptions | null {
  if (input.selectedOptions) {
    const parsed = selectedProductOptionsSchema.safeParse(input.selectedOptions);
    if (parsed.success) return parsed.data;
  }
  const size = input.sizeLabel?.trim();
  if (!size || size.toLowerCase() === "default title") return null;
  const customisation = cartCustomisationSchema.safeParse(input.customisation ?? { mode: "none" });
  if (!customisation.success) return null;
  return cartCustomisationToSelected(customisation.data, size, input.colour ?? null);
}

export function customisationPriceForSelected(enabled: boolean): string {
  return enabled ? SJD_CUSTOMISATION_PRICE_AMOUNT : "0.00";
}

export function fingerprintSelectedOptions(options: SelectedProductOptions): string {
  const payload = {
    size: options.size.trim(),
    colour: options.colour?.trim() ?? "",
    enabled: options.customisation.enabled,
    name: options.customisation.name?.trim().toUpperCase() ?? "",
    number: options.customisation.number?.trim() ?? "",
    message: options.customisation.message?.trim() ?? ""
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function formatSelectedOptionsSummary(options: SelectedProductOptions): string[] {
  const lines: string[] = [];
  if (options.colour) lines.push(`Colour: ${options.colour}`);
  lines.push(`Size: ${options.size}`);
  lines.push(`Customisation: ${options.customisation.enabled ? "Yes" : "No"}`);
  if (options.customisation.enabled) {
    if (options.customisation.name) lines.push(`Name: ${options.customisation.name}`);
    if (options.customisation.number) lines.push(`Number: ${options.customisation.number}`);
    if (options.customisation.message) lines.push(`Message: ${options.customisation.message}`);
  }
  return lines;
}

export function normalizeProductionSelectedOptions(
  input: SelectedProductOptions
): SelectedProductOptions {
  const parsed = selectedProductOptionsSchema.parse(input);
  return {
    ...parsed,
    colour: parsed.colour?.trim() || null,
    size: parsed.size.trim(),
    customisation: {
      enabled: parsed.customisation.enabled,
      ...(parsed.customisation.name
        ? { name: parsed.customisation.name.trim().toUpperCase() }
        : {}),
      ...(parsed.customisation.number ? { number: parsed.customisation.number.trim() } : {}),
      ...(parsed.customisation.message ? { message: parsed.customisation.message.trim() } : {})
    }
  };
}

export function validateSizeAgainstOptionSet(
  size: string,
  optionSetSlug: string | null | undefined
): { ok: boolean; detail: string } {
  if (!optionSetSlug) {
    return { ok: false, detail: "No size option set assigned to this product." };
  }
  const set = getSizeOptionSet(optionSetSlug);
  if (!set) {
    return { ok: false, detail: `Unknown option set: ${optionSetSlug}` };
  }
  if (!set.sizes.includes(size)) {
    return { ok: false, detail: `Size "${size}" is not valid for ${set.title}.` };
  }
  return { ok: true, detail: "Size valid." };
}
