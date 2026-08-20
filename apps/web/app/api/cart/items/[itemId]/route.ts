import { z } from "zod";
import { getCartSessionId, removeCartItem, updateCartItemQuantity } from "@/lib/cart";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(99)
});

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

function hasCartSession(request: Request): boolean {
  return (request.headers.get("cookie") ?? "").includes("sjh_cart_session=");
}

async function enforceCartWriteLimit(request: Request): Promise<Response | null> {
  const limited = rateLimit(`cart-write:${getClientIp(request)}`, {
    limit: 60,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const limited = await enforceCartWriteLimit(request);
  if (limited) {
    return limited;
  }

  if (!hasCartSession(request)) {
    return Response.json({ error: "Cart not found." }, { status: 404 });
  }

  const { itemId } = await context.params;
  const body = updateItemSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Invalid quantity." }, { status: 400 });
  }

  const sessionId = await getCartSessionId();

  try {
    const cart = await updateCartItemQuantity(sessionId, itemId, body.data.quantity);

    return Response.json({ cart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update cart item.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const limited = await enforceCartWriteLimit(request);
  if (limited) {
    return limited;
  }

  if (!hasCartSession(request)) {
    return Response.json({ error: "Cart not found." }, { status: 404 });
  }

  const { itemId } = await context.params;
  const sessionId = await getCartSessionId();

  try {
    const cart = await removeCartItem(sessionId, itemId);

    return Response.json({ cart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove cart item.";
    return Response.json({ error: message }, { status: 400 });
  }
}
