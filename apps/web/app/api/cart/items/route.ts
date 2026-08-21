import { z } from "zod";
import { cartCustomisationSchema } from "@sjh/shared";
import { addItemToCart, resolveCartCustomisationPricing } from "@sjh/database";
import { cartSessionCookieHeader, createCartSessionId, getCartSessionId } from "@/lib/cart";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(99).optional(),
  customisation: cartCustomisationSchema.optional()
});

export async function POST(request: Request) {
  const limited = rateLimit(`cart-write:${getClientIp(request)}`, {
    limit: 60,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const body = addItemSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Invalid cart item or customisation." }, { status: 400 });
  }

  let sessionId = await getCartSessionId();
  let setCookie = false;

  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader.includes("sjh_cart_session=")) {
    sessionId = createCartSessionId();
    setCookie = true;
  }

  const customisation = body.data.customisation ?? { mode: "none" as const };

  try {
    const priced = await resolveCartCustomisationPricing(body.data.variantId, customisation);
    const cart = await addItemToCart(
      sessionId,
      body.data.variantId,
      body.data.quantity ?? 1,
      undefined,
      priced.customisation,
      priced.customisationPriceAmount
    );

    return Response.json(
      { cart },
      setCookie ? { headers: { "Set-Cookie": cartSessionCookieHeader(sessionId) } } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add item to cart.";
    return Response.json({ error: message }, { status: 400 });
  }
}
