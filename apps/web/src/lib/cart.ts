import { cookies } from "next/headers";
import {
  addItemToCart,
  getCartBySessionId,
  getOrCreateCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartSnapshot
} from "@sjh/database";

export const CART_SESSION_COOKIE = "sjh_cart_session";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function createCartSessionId(): string {
  return crypto.randomUUID();
}

export async function getCartSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (existing) {
    return existing;
  }

  return createCartSessionId();
}

export function cartSessionCookieHeader(sessionId: string): string {
  return `${CART_SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CART_COOKIE_MAX_AGE}`;
}

export async function loadCart(): Promise<CartSnapshot> {
  const sessionId = await getCartSessionId();
  return getCartBySessionId(sessionId);
}

export async function ensureCart(sessionId: string): Promise<CartSnapshot> {
  return getOrCreateCart(sessionId);
}

export {
  addItemToCart,
  getCartBySessionId,
  removeCartItem,
  updateCartItemQuantity,
  type CartSnapshot
};
