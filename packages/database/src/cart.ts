import { and, eq } from "drizzle-orm";
import {
  cartItems,
  carts,
  createDatabaseClient,
  productImages,
  products,
  productVariants
} from "./index";

export type CartLineItem = {
  id: string;
  quantity: number;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  priceAmount: string;
  currencyCode: string;
  imageUrl?: string;
  lineTotalAmount: string;
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
      priceAmount: productVariants.priceAmount,
      currencyCode: productVariants.currencyCode,
      imageUrl: productImages.url
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.sortOrder, 0))
    )
    .where(eq(cartItems.cartId, cart.id));

  const items: CartLineItem[] = rows.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    productId: row.productId,
    productSlug: row.productSlug,
    productTitle: row.productTitle,
    variantId: row.variantId,
    variantTitle: row.variantTitle,
    priceAmount: row.priceAmount,
    currencyCode: row.currencyCode,
    ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    lineTotalAmount: multiplyMoney(row.priceAmount, row.quantity)
  }));

  return {
    id: cart.id,
    sessionId: cart.sessionId,
    currencyCode: cart.currencyCode,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalAmount: sumMoney(items.map((item) => item.lineTotalAmount)),
    items
  };
}

export async function addItemToCart(
  sessionId: string,
  variantId: string,
  quantity = 1,
  databaseUrl?: string
): Promise<CartSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const cart = await getOrCreateCart(sessionId, databaseUrl);

  if (!cart.id) {
    throw new Error("Failed to resolve cart.");
  }

  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      isAvailable: productVariants.isAvailable
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

  const [existingItem] = await db
    .select({ id: cartItems.id, quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variant.id)))
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
      quantity
    });
  }

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));

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
