import { NextResponse } from "next/server";
import { applyOfferToAmounts, evaluateWelcome10Eligibility, getCartBySessionId } from "@sjh/database";
import { getCartSessionId } from "@/lib/cart";

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? undefined;
  const eligibility = await evaluateWelcome10Eligibility({
    ...(email ? { email } : {})
  });

  let discountPreview: string | undefined;
  if (eligibility.eligible && eligibility.offer) {
    const sessionId = await getCartSessionId();
    if (sessionId) {
      const cart = await getCartBySessionId(sessionId);
      if (cart.itemCount > 0) {
        const applied = applyOfferToAmounts(cart.subtotalAmount, eligibility.offer);
        discountPreview = `${applied.discountAmount} ${cart.currencyCode}`;
      }
    }
  }

  return NextResponse.json({
    eligible: eligibility.eligible,
    reasons: eligibility.reasons,
    checks: eligibility.checks,
    ...(discountPreview ? { discountPreview } : {})
  });
}
