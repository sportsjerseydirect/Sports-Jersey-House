/** Test WELCOME10 eligibility and discount math */
import { captureMarketingLead } from "../marketing";
import { applyOfferToAmounts, evaluateWelcome10Eligibility } from "../offers";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const newEmail = `welcome10.test+${Date.now()}@sjh-internal.test`;
  await captureMarketingLead({ email: newEmail, source: "popup", offerCode: "WELCOME10" }, url);
  const eligible = await evaluateWelcome10Eligibility({ email: newEmail }, url);

  const subtotal = "100.00";
  const applied =
    eligible.eligible && eligible.offer
      ? applyOfferToAmounts(subtotal, eligible.offer)
      : null;

  const repeat = await evaluateWelcome10Eligibility({ email: "e2e.test+1@sjh-internal.test" }, url);

  console.log(
    JSON.stringify(
      {
        ok: Boolean(eligible.eligible && applied && Number.parseFloat(applied.discountAmount) === 10),
        newVisitor: {
          email: newEmail,
          eligible: eligible.eligible,
          reasons: eligible.reasons,
          discount: applied?.discountAmount,
          totalAfter: applied?.totalAfterDiscount
        },
        repeatOrUsed: {
          eligible: repeat.eligible,
          reasons: repeat.reasons
        }
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
