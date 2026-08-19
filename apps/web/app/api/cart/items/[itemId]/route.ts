import { z } from "zod";
import { getCartSessionId, removeCartItem, updateCartItemQuantity } from "@/lib/cart";

export const dynamic = "force-dynamic";

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).max(99)
});

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

function requireCartSessionId(request: Request): string | Response {
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!cookieHeader.includes("sjh_cart_session=")) {
    return Response.json({ error: "Cart not found." }, { status: 404 });
  }

  return "";
}

export async function PATCH(request: Request, context: RouteContext) {
  const sessionCheck = requireCartSessionId(request);

  if (sessionCheck instanceof Response) {
    return sessionCheck;
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
  const sessionCheck = requireCartSessionId(request);

  if (sessionCheck instanceof Response) {
    return sessionCheck;
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
