import { abandonedCheckoutDraftSchema } from "@sjh/shared";
import { recordAbandonedCheckout } from "@sjh/database";
import { createCartSessionId, getCartSessionId, cartSessionCookieHeader } from "@/lib/cart";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(`checkout-abandon:${getClientIp(request)}`, {
    limit: 30,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const body = abandonedCheckoutDraftSchema.safeParse(await request.json().catch(() => ({})));

  if (!body.success) {
    return Response.json({ error: "Invalid abandoned checkout payload." }, { status: 400 });
  }

  let sessionId = await getCartSessionId();
  let setCookie = false;
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader.includes("sjh_cart_session=")) {
    sessionId = createCartSessionId();
    setCookie = true;
  }

  try {
    await recordAbandonedCheckout(sessionId, body.data);
    return Response.json(
      { ok: true },
      setCookie ? { headers: { "Set-Cookie": cartSessionCookieHeader(sessionId) } } : undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record checkout draft.";
    return Response.json({ error: message }, { status: 400 });
  }
}
