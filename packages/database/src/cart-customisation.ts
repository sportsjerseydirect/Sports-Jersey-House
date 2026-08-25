/**
 * Cart add with SJD-compatible selected options (size + customisation).
 * Replaces price trust from client — customisation price computed server-side.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { CartCustomisation, SelectedProductOptions } from "@sjh/shared";
import { cartCustomisationSchema, customisationPriceForMode } from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { resolveSelectedProductOptions, toLegacyCustomisation } from "./product-options";
import { customisationProfiles, productVariants, products } from "./schema-catalogue";

export type ResolvedCartCustomisation = {
  customisation: CartCustomisation;
  customisationPriceAmount: string;
  selectedOptions?: SelectedProductOptions;
  sizeLabel?: string;
  colourLabel?: string | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
};

function resolveUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

/**
 * Preferred path: structured selected_options (size + SJD customisation).
 */
export async function resolveCartLineOptions(
  variantId: string,
  selectedOptions: unknown,
  databaseUrl?: string
): Promise<ResolvedCartCustomisation> {
  const resolved = await resolveSelectedProductOptions(variantId, selectedOptions, databaseUrl);
  return {
    customisation: toLegacyCustomisation(resolved.selected),
    customisationPriceAmount: resolved.customisationPriceAmount,
    selectedOptions: resolved.selected,
    sizeLabel: resolved.selected.size,
    colourLabel: resolved.colour,
    shopifyProductId: resolved.shopifyProductId,
    shopifyVariantId: resolved.shopifyVariantId
  };
}

/**
 * Legacy path: mode-based customisation only (no size). Kept for older clients.
 * Prefer resolveCartLineOptions for storefront.
 */
export async function resolveCartCustomisationPricing(
  variantId: string,
  customisation: CartCustomisation,
  databaseUrl?: string
): Promise<ResolvedCartCustomisation> {
  const url = resolveUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isAvailable: productVariants.isAvailable
    })
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), isNull(productVariants.deletedAt)))
    .limit(1);

  if (!variant) {
    throw new Error("Variant not found.");
  }

  if (!variant.isAvailable) {
    throw new Error("Variant is not available.");
  }

  if (customisation.mode === "none") {
    return { customisation, customisationPriceAmount: "0.00" };
  }

  const [product] = await db
    .select({
      customisationEnabled: products.customisationEnabled,
      customisationProfileId: products.customisationProfileId
    })
    .from(products)
    .where(eq(products.id, variant.productId))
    .limit(1);

  if (!product?.customisationEnabled || !product.customisationProfileId) {
    throw new Error("Customisation is not available for this product.");
  }

  const [profile] = await db
    .select()
    .from(customisationProfiles)
    .where(
      and(eq(customisationProfiles.id, product.customisationProfileId), isNull(customisationProfiles.deletedAt))
    )
    .limit(1);

  if (!profile) {
    throw new Error("Customisation profile not found.");
  }

  const parsed = cartCustomisationSchema.parse(customisation);
  const allowed = profile.allowedModes as string[];
  if (!allowed.includes(parsed.mode) && parsed.mode !== "custom") {
    throw new Error("Selected customisation mode is not allowed.");
  }

  // SJD flat surcharge for any non-none customisation.
  if (parsed.mode === "custom") {
    return {
      customisation: parsed,
      customisationPriceAmount: customisationPriceForMode(
        {
          namePriceAmount: profile.namePriceAmount,
          numberPriceAmount: profile.numberPriceAmount,
          nameNumberPriceAmount: profile.nameNumberPriceAmount,
          messagePriceAmount: profile.messagePriceAmount
        },
        "name_number"
      )
    };
  }

  return {
    customisation: parsed,
    customisationPriceAmount: customisationPriceForMode(
      {
        namePriceAmount: profile.namePriceAmount,
        numberPriceAmount: profile.numberPriceAmount,
        nameNumberPriceAmount: profile.nameNumberPriceAmount,
        messagePriceAmount: profile.messagePriceAmount
      },
      parsed.mode
    )
  };
}
