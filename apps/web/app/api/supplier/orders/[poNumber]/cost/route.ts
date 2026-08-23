import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { supplierSubmitCost } from "@sjh/database";

const bodySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  shippingCost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  notes: z.string().max(500).optional()
});

type RouteContext = { params: Promise<{ poNumber: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid cost amount." }, { status: 400 });
  }

  const { poNumber } = await context.params;
  try {
    await supplierSubmitCost(session.supplierId, session.supplierUserId, {
      poNumber,
      amount: parsed.data.amount,
      ...(parsed.data.shippingCost ? { shippingCost: parsed.data.shippingCost } : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {})
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed." },
      { status: 400 }
    );
  }
}
