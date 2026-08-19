import { getCartSessionId, loadCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getCartSessionId();
  const cart = await loadCart();

  return Response.json({
    sessionId,
    cart
  });
}
