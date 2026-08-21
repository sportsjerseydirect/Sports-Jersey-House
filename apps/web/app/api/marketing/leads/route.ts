import { NextResponse } from "next/server";
import { z } from "zod";
import { captureMarketingLead } from "@sjh/database";

const schema = z.object({
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(6).max(40).optional(),
  source: z.enum(["popup", "checkout", "footer", "abandoned_cart", "other"]).optional(),
  offerCode: z.string().trim().max(40).optional()
});

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid lead capture." }, { status: 400 });
  }

  if (!body.data.email && !body.data.phone) {
    return NextResponse.json({ error: "Email or phone is required." }, { status: 400 });
  }

  try {
    const result = await captureMarketingLead({
      ...(body.data.email ? { email: body.data.email } : {}),
      ...(body.data.phone ? { phone: body.data.phone } : {}),
      ...(body.data.source ? { source: body.data.source } : { source: "popup" }),
      ...(body.data.offerCode ? { offerCode: body.data.offerCode } : { offerCode: "WELCOME10" })
    });
    return NextResponse.json({
      ok: true,
      offerCode: result.lead.offerCode,
      message: `Thanks — use ${result.lead.offerCode ?? "WELCOME10"} for 10% off.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture lead.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
