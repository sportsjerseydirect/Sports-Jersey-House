import { z } from "zod";
import { addItemToCart, cartSessionCookieHeader, createCartSessionId, getCartSessionId } from "@/lib/cart";

const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(99).optional()
});

export async function POST(request: Request) {
  const body = addItemSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Invalid cart item." }, { status: 400 });
  }

  let sessionId = await getCartSessionId();
  let setCookie = false;

  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader.includes("sjh_cart_session=")) {
    sessionId = createCartSessionId();
    setCookie = true;
  }

  try {
    const cart = await addItemToCart(sessionId, body.data.variantId, body.data.quantity ?? 1);

    return Response.json(
      { cart },
      setCookie ? { headers: { "Set-Cookie": cartSessionCookieHeader(sessionId) } } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add item to cart.";
    return Response.json({ error: message }, { status: 400 });
  }
}
