import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { supplierSubmitTracking } from "@sjh/database";

const bodySchema = z.object({
  orderItemId: z.string().uuid(),
  trackingNumber: z.string().min(4).max(64),
  courier: z.string().max(64).optional(),
  note: z.string().max(500).optional()
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
    return NextResponse.json({ ok: false, error: "Invalid tracking payload." }, { status: 400 });
  }

  const { poNumber } = await context.params;
  try {
    await supplierSubmitTracking(session.supplierId, session.supplierUserId, {
      poNumber,
      orderItemId: parsed.data.orderItemId,
      trackingNumber: parsed.data.trackingNumber,
      ...(parsed.data.courier ? { courier: parsed.data.courier } : {}),
      ...(parsed.data.note ? { note: parsed.data.note } : {})
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed." },
      { status: 400 }
    );
  }
}
