import { and, eq, isNull } from "drizzle-orm";
import {
  colourFromVariantOptions,
  customisationPriceForSelected,
  fingerprintSelectedOptions,
  getSizeOptionSet,
  normalizeProductionSelectedOptions,
  selectedOptionsToCartCustomisation,
  selectedProductOptionsSchema,
  sizeOptionSetSlugForSport,
  validateSizeAgainstOptionSet,
  variantAxisFromOptions,
  type SelectedProductOptions,
  type SizeOptionSet
} from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { productOptionSets, productVariants, products } from "./schema-catalogue";

export type ResolvedProductOptions = {
  productId: string;
  variantId: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  colour: string | null;
  variantAxis: ReturnType<typeof variantAxisFromOptions>;
  optionSet: SizeOptionSet | null;
  optionSetSlug: string | null;
  requiresSize: boolean;
  customisationEnabled: boolean;
  selected: SelectedProductOptions;
  customisationPriceAmount: string;
  unitPriceAmount: string;
  currencyCode: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
};

function resolveUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

export async function getProductOptionSetForProduct(
  productId: string,
  databaseUrl?: string
): Promise<SizeOptionSet | null> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));
  const [row] = await db
    .select({
      slug: productOptionSets.slug,
      title: productOptionSets.title,
      sport: productOptionSets.sport,
      sizes: productOptionSets.sizes,
      productSport: products.sport
    })
    .from(products)
    .leftJoin(productOptionSets, eq(products.optionSetId, productOptionSets.id))
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);

  if (!row) return null;

  if (row.slug && Array.isArray(row.sizes) && row.sizes.length > 0) {
    const fromDb = getSizeOptionSet(row.slug);
    if (fromDb) return fromDb;
    return {
      slug: row.slug as SizeOptionSet["slug"],
      title: row.title ?? row.slug,
      sport: row.sport ?? row.productSport ?? "Unknown",
      sizes: row.sizes as string[]
    };
  }

  const inferred = sizeOptionSetSlugForSport(row.productSport);
  return inferred ? getSizeOptionSet(inferred) : null;
}

/**
 * Server-side validation of customer-selected options.
 * Never trusts client prices.
 */
export async function resolveSelectedProductOptions(
  variantId: string,
  rawOptions: unknown,
  databaseUrl?: string
): Promise<ResolvedProductOptions> {
  const db = createDatabaseClient(resolveUrl(databaseUrl));

  const [row] = await db
    .select({
      variantId: productVariants.id,
      variantTitle: productVariants.title,
      variantOptions: productVariants.options,
      sku: productVariants.sku,
      priceAmount: productVariants.priceAmount,
      currencyCode: productVariants.currencyCode,
      isAvailable: productVariants.isAvailable,
      shopifyVariantId: productVariants.shopifyId,
      productId: products.id,
      productTitle: products.title,
      shopifyProductId: products.shopifyId,
      customisationEnabled: products.customisationEnabled,
      optionSetId: products.optionSetId,
      optionSetSlug: productOptionSets.slug,
      optionSetTitle: productOptionSets.title,
      optionSetSport: productOptionSets.sport,
      optionSetSizes: productOptionSets.sizes,
      sport: products.sport
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(productOptionSets, eq(productOptionSets.id, products.optionSetId))
    .where(and(eq(productVariants.id, variantId), isNull(productVariants.deletedAt), isNull(products.deletedAt)))
    .limit(1);

  if (!row) {
    throw new Error("Variant not found.");
  }
  if (!row.isAvailable) {
    throw new Error("Variant is not available.");
  }

  const parsed = selectedProductOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid product options.");
  }

  let optionSet: SizeOptionSet | null = null;
  if (row.optionSetSlug && Array.isArray(row.optionSetSizes) && row.optionSetSizes.length > 0) {
    optionSet =
      getSizeOptionSet(row.optionSetSlug) ??
      ({
        slug: row.optionSetSlug as SizeOptionSet["slug"],
        title: row.optionSetTitle ?? row.optionSetSlug,
        sport: row.optionSetSport ?? row.sport ?? "Unknown",
        sizes: row.optionSetSizes as string[]
      } as SizeOptionSet);
  } else {
    const inferred = sizeOptionSetSlugForSport(row.sport);
    optionSet = inferred ? getSizeOptionSet(inferred) : null;
  }

  if (!optionSet) {
    throw new Error("This product has no size options configured. It cannot be ordered until reviewed.");
  }

  const sizeCheck = validateSizeAgainstOptionSet(parsed.data.size, optionSet.slug);
  if (!sizeCheck.ok) {
    throw new Error(sizeCheck.detail);
  }

  const options = row.variantOptions as Record<string, string> | null;
  const colour =
    parsed.data.colour?.trim() ||
    colourFromVariantOptions(options, row.variantTitle) ||
    null;

  if (parsed.data.customisation.enabled && !row.customisationEnabled) {
    throw new Error("Customisation is not available for this product.");
  }

  const selected = normalizeProductionSelectedOptions({
    ...parsed.data,
    colour,
    optionSetSlug: optionSet.slug,
    customisation: row.customisationEnabled
      ? parsed.data.customisation
      : { enabled: false }
  });

  return {
    productId: row.productId,
    variantId: row.variantId,
    shopifyProductId: row.shopifyProductId,
    shopifyVariantId: row.shopifyVariantId,
    colour,
    variantAxis: variantAxisFromOptions(options),
    optionSet,
    optionSetSlug: optionSet.slug,
    requiresSize: true,
    customisationEnabled: row.customisationEnabled,
    selected,
    customisationPriceAmount: customisationPriceForSelected(selected.customisation.enabled),
    unitPriceAmount: row.priceAmount,
    currencyCode: row.currencyCode,
    productTitle: row.productTitle,
    variantTitle: row.variantTitle,
    sku: row.sku
  };
}

export function toLegacyCustomisation(selected: SelectedProductOptions) {
  return selectedOptionsToCartCustomisation(selected);
}

export function optionsFingerprint(selected: SelectedProductOptions): string {
  return fingerprintSelectedOptions(selected);
}
