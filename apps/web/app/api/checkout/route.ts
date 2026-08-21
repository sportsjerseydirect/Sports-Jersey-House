import { guestCheckoutSchema } from "@sjh/shared";
import { createOrderFromCart } from "@sjh/database";
import { cartSessionCookieHeader, createCartSessionId, getCartSessionId } from "@/lib/cart";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(`checkout:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const body = guestCheckoutSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json(
      { error: "Please complete email, phone, and shipping details.", details: body.error.flatten() },
      { status: 400 }
    );
  }

  let sessionId = await getCartSessionId();
  let setCookie = false;
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader.includes("sjh_cart_session=")) {
    sessionId = createCartSessionId();
    setCookie = true;
  }

  try {
    const order = await createOrderFromCart(sessionId, body.data);

    return Response.json(
      { orderNumber: order.orderNumber, order },
      setCookie ? { headers: { "Set-Cookie": cartSessionCookieHeader(sessionId) } } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to place order.";
    return Response.json({ error: message }, { status: 400 });
  }
}
