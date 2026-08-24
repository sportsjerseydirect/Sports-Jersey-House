/**
 * Backfill Stripe payment fee for a paid order using Production STRIPE_SECRET_KEY.
 * Usage: vercel env run -e production -- node --import tsx packages/database/src/cli/backfill-stripe-fee.ts SJH-10015
 */
import { Stripe } from "stripe";
import postgres from "postgres";

async function feeForPi(stripe: Stripe, paymentIntentId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"]
    });
    let charge = paymentIntent.latest_charge;
    if (typeof charge === "string") {
      charge = await stripe.charges.retrieve(charge, { expand: ["balance_transaction"] });
    }
    if (!charge || typeof charge === "string") {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    let balanceTransaction = charge.balance_transaction;
    if (typeof balanceTransaction === "string") {
      balanceTransaction = await stripe.balanceTransactions.retrieve(balanceTransaction);
    }
    if (!balanceTransaction || typeof balanceTransaction === "string") {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    return (balanceTransaction.fee / 100).toFixed(2);
  }
  return null;
}

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber) throw new Error("order number required");
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || secret.includes("_live_")) throw new Error("TEST Stripe secret required");
  const dbUrl = (process.env.DATABASE_URL || "").replace(":6543/", ":5432/");
  if (!dbUrl) throw new Error("DATABASE_URL required");

  const sql = postgres(dbUrl, { ssl: "require", max: 1, prepare: false });
  const [order] = await sql`
    SELECT id, order_number, stripe_payment_intent_id, payment_fee_amount, status
    FROM orders WHERE order_number = ${orderNumber} LIMIT 1`;
  if (!order?.stripe_payment_intent_id) {
    console.log(JSON.stringify({ ok: false, reason: "missing_pi" }));
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  const stripe = new Stripe(secret, { apiVersion: "2026-07-29.dahlia" });
  const fee = await feeForPi(stripe, order.stripe_payment_intent_id);
  if (fee == null) {
    console.log(JSON.stringify({ ok: false, reason: "fee_unavailable", prior: order.payment_fee_amount }));
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  await sql`
    UPDATE orders
    SET payment_fee_amount = ${fee}, updated_at = now()
    WHERE id = ${order.id}`;
  console.log(
    JSON.stringify({
      ok: true,
      orderNumber,
      priorFee: order.payment_fee_amount,
      fee,
      hasPi: true
    })
  );
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
