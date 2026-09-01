import { and, eq, inArray } from "drizzle-orm";
import type { CartCustomisation, SelectedProductOptions } from "@sjh/shared";
import {
  cartCustomisationSchema,
  fingerprintSelectedOptions,
  formatSelectedOptionsSummary,
  resolveImageUrlForColour,
  resolveLineSelectedOptions
} from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { cartItems, carts, productImages, products, productVariants } from "./schema-catalogue";

export type CartCustomisationInput = CartCustomisation;

export type CartLineItem = {
  id: string;
  quantity: number;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  sizeLabel: string | null;
  colourLabel: string | null;
  priceAmount: string;
  currencyCode: string;
  imageUrl?: string;
  lineTotalAmount: string;
  customisation: CartCustomisation;
  customisationPriceAmount: string;
  selectedOptions: SelectedProductOptions | null;
  optionsSummary: string[];
};

export type CartSnapshot = {
  id: string;
  sessionId: string;
  currencyCode: string;
  itemCount: number;
  subtotalAmount: string;
  items: CartLineItem[];
};

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for cart operations.");
  }
  return url;
}

function multiplyMoney(amount: string, quantity: number): string {
  return (Number.parseFloat(amount) * quantity).toFixed(2);
}

function sumMoney(amounts: string[]): string {
  return amounts.reduce((total, amount) => total + Number.parseFloat(amount), 0).toFixed(2);
}

function addMoney(a: string, b: string): string {
  return (Number.parseFloat(a) + Number.parseFloat(b)).toFixed(2);
}

export function fingerprintCustomisation(customisation: CartCustomisation): string {
  if (customisation.mode === "none") {
    return "none";
  }

  const payload = {
    mode: customisation.mode,
    name: customisation.name?.trim().toUpperCase() ?? "",
    number: customisation.number?.trim() ?? "",
    message: customisation.message?.trim() ?? ""
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function lineFingerprint(
  selectedOptions: SelectedProductOptions | null | undefined,
  customisation: CartCustomisation
): string {
  if (selectedOptions) {
    return fingerprintSelectedOptions(selectedOptions);
  }
  return fingerprintCustomisation(customisation);
}

function normalizeCustomisation(input?: CartCustomisationInput): CartCustomisation {
  return cartCustomisationSchema.parse(input ?? { mode: "none" });
}

export async function getOrCreateCart(sessionId: string, databaseUrl?: string): Promise<CartSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const existing = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);
  if (!existing[0]) {
    await db.insert(carts).values({ sessionId });
  }
  return getCartBySessionId(sessionId, databaseUrl);
}

export async function getCartBySessionId(sessionId: string, databaseUrl?: string): Promise<CartSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [cart] = await db.select().from(carts).where(eq(carts.sessionId, sessionId)).limit(1);

  if (!cart) {
    return {
      id: "",
      sessionId,
      currencyCode: "USD",
      itemCount: 0,
      subtotalAmount: "0.00",
      items: []
    };
  }

  const rows = await db
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      productId: products.id,
      productSlug: products.slug,
      productTitle: products.title,
      variantId: productVariants.id,
      variantTitle: productVariants.title,
      variantOptions: productVariants.options,
      sku: productVariants.sku,
      sizeLabel: productVariants.sizeLabel,
      priceAmount: productVariants.priceAmount,
      unitPriceAmount: cartItems.unitPriceAmount,
      currencyCode: productVariants.currencyCode,
      customisation: cartItems.customisation,
      customisationPriceAmount: cartItems.customisationPriceAmount,
      selectedOptions: cartItems.selectedOptions
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cart.id));

  const productIds = [...new Set(rows.map((row) => row.productId))];
  const imageRows =
    productIds.length > 0
      ? await db
          .select({
            productId: productImages.productId,
            url: productImages.url,
            altText: productImages.altText,
            sortOrder: productImages.sortOrder
          })
          .from(productImages)
          .where(inArray(productImages.productId, productIds))
          .orderBy(productImages.sortOrder)
      : [];

  const imagesByProduct = new Map<
    string,
    Array<{ url: string; altText: string | null; sortOrder: number }>
  >();
  for (const image of imageRows) {
    const list = imagesByProduct.get(image.productId) ?? [];
    list.push(image);
    imagesByProduct.set(image.productId, list);
  }

  const items: CartLineItem[] = rows.map((row) => {
    const customisation = cartCustomisationSchema.parse(row.customisation ?? { mode: "none" });
    const unitPrice = row.unitPriceAmount ?? row.priceAmount;
    const customisationPrice = row.customisationPriceAmount ?? "0.00";
    const unitWithCustomisation = addMoney(unitPrice, customisationPrice);
    const selectedOptions = resolveLineSelectedOptions({
      selectedOptions: row.selectedOptions,
      customisation,
      sizeLabel: (row.selectedOptions as SelectedProductOptions | null)?.size ?? row.sizeLabel,
      variantTitle: row.variantTitle
    });
    const colourLabel = selectedOptions?.colour ?? null;
    const sizeLabel = selectedOptions?.size ?? row.sizeLabel ?? null;
    const productImagesForLine = imagesByProduct.get(row.productId) ?? [];
    const resolvedImageUrl = resolveImageUrlForColour(productImagesForLine, colourLabel);

    return {
      id: row.id,
      quantity: row.quantity,
      productId: row.productId,
      productSlug: row.productSlug,
      productTitle: row.productTitle,
      variantId: row.variantId,
      variantTitle: row.variantTitle,
      sku: row.sku ?? null,
      sizeLabel,
      colourLabel,
      priceAmount: unitPrice,
      currencyCode: row.currencyCode,
      ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
      lineTotalAmount: multiplyMoney(unitWithCustomisation, row.quantity),
      customisation,
      customisationPriceAmount: customisationPrice,
      selectedOptions,
      optionsSummary: selectedOptions
        ? formatSelectedOptionsSummary(selectedOptions)
        : [
            ...(colourLabel ? [`Colour: ${colourLabel}`] : []),
            ...(sizeLabel ? [`Size: ${sizeLabel}`] : [`Variant: ${row.variantTitle}`])
          ]
    };
  });

  return {
    id: cart.id,
    sessionId: cart.sessionId,
    currencyCode: items[0]?.currencyCode ?? cart.currencyCode,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalAmount: sumMoney(items.map((item) => item.lineTotalAmount)),
    items
  };
}

export async function addItemToCart(
  sessionId: string,
  variantId: string,
  quantity = 1,
  databaseUrl?: string,
  customisationInput?: CartCustomisationInput,
  customisationPriceAmount = "0.00",
  selectedOptions?: SelectedProductOptions | null
): Promise<CartSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const cart = await getOrCreateCart(sessionId, databaseUrl);
  const customisation = normalizeCustomisation(customisationInput);
  const fingerprint = lineFingerprint(selectedOptions, customisation);

  if (!cart.id) {
    throw new Error("Failed to resolve cart.");
  }

  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isAvailable: productVariants.isAvailable,
      priceAmount: productVariants.priceAmount,
      currencyCode: productVariants.currencyCode
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) {
    throw new Error("Variant not found.");
  }

  if (!variant.isAvailable) {
    throw new Error("Variant is not available.");
  }

  if (cart.currencyCode && cart.itemCount > 0 && cart.currencyCode !== variant.currencyCode) {
    throw new Error("Cart already contains items in a different currency.");
  }

  const [existingItem] = await db
    .select({ id: cartItems.id, quantity: cartItems.quantity })
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.variantId, variant.id),
        eq(cartItems.customisationFingerprint, fingerprint)
      )
    )
    .limit(1);

  if (existingItem) {
    await db
      .update(cartItems)
      .set({ quantity: existingItem.quantity + quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    await db.insert(cartItems).values({
      cartId: cart.id,
      productId: variant.productId,
      variantId: variant.id,
      quantity,
      customisation,
      customisationFingerprint: fingerprint,
      customisationPriceAmount,
      selectedOptions: selectedOptions ?? null,
      unitPriceAmount: variant.priceAmount
    });
  }

  await db
    .update(carts)
    .set({ updatedAt: new Date(), currencyCode: variant.currencyCode })
    .where(eq(carts.id, cart.id));

  return getCartBySessionId(sessionId, databaseUrl);
}

export async function updateCartItemQuantity(
  sessionId: string,
  itemId: string,
  quantity: number,
  databaseUrl?: string
): Promise<CartSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const cart = await getCartBySessionId(sessionId, databaseUrl);

  if (!cart.id) {
    throw new Error("Cart not found.");
  }

  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  }

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));

  return getCartBySessionId(sessionId, databaseUrl);
}

export async function removeCartItem(
  sessionId: string,
  itemId: string,
  databaseUrl?: string
): Promise<CartSnapshot> {
  return updateCartItemQuantity(sessionId, itemId, 0, databaseUrl);
}
