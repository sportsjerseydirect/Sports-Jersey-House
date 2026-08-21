import { and, eq, isNull } from "drizzle-orm";
import type { CartCustomisation, CustomisationMode } from "@sjh/shared";
import { customisationPriceForMode } from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { customisationProfiles, productVariants, products } from "./schema-catalogue";

export type ResolvedCartCustomisation = {
  customisation: CartCustomisation;
  customisationPriceAmount: string;
};

export async function resolveCartCustomisationPricing(
  variantId: string,
  customisation: CartCustomisation,
  databaseUrl?: string
): Promise<ResolvedCartCustomisation> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

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

  const allowed = profile.allowedModes as CustomisationMode[];
  if (!allowed.includes(customisation.mode)) {
    throw new Error("Selected customisation mode is not allowed.");
  }

  if (
    (customisation.mode === "name" || customisation.mode === "name_number") &&
    (customisation.name?.length ?? 0) > profile.nameMaxLength
  ) {
    throw new Error("Name exceeds maximum length.");
  }

  if (
    (customisation.mode === "number" || customisation.mode === "name_number") &&
    (customisation.number?.length ?? 0) > profile.numberMaxLength
  ) {
    throw new Error("Number exceeds maximum length.");
  }

  if (customisation.mode === "message" && (customisation.message?.length ?? 0) > profile.messageMaxLength) {
    throw new Error("Message exceeds maximum length.");
  }

  return {
    customisation,
    customisationPriceAmount: customisationPriceForMode(
      {
        namePriceAmount: profile.namePriceAmount,
        numberPriceAmount: profile.numberPriceAmount,
        nameNumberPriceAmount: profile.nameNumberPriceAmount,
        messagePriceAmount: profile.messagePriceAmount
      },
      customisation.mode
    )
  };
}
