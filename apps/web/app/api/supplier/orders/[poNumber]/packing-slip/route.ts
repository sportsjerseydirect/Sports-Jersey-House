import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { getSupplierPurchaseOrderDetail } from "@sjh/database";

type RouteContext = { params: Promise<{ poNumber: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { poNumber } = await context.params;
  try {
    const detail = await getSupplierPurchaseOrderDetail(session.supplierId, poNumber);
    if (!detail.packingSlipHtml) {
      return NextResponse.json({ ok: false, error: "Packing slip not available." }, { status: 404 });
    }

    return new NextResponse(detail.packingSlipHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="packing-slip-${poNumber}.html"`
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
}
