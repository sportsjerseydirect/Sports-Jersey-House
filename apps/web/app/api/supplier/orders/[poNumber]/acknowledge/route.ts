import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { supplierAcknowledgePo } from "@sjh/database";

type RouteContext = { params: Promise<{ poNumber: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { poNumber } = await context.params;
  try {
    await supplierAcknowledgePo(session.supplierId, session.supplierUserId, poNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed." },
      { status: 400 }
    );
  }
}
