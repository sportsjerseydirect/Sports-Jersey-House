import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPurchaseOrderBatch } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const batchSchema = z.object({
  batchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = batchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid batch date." }, { status: 400 });
  }

  try {
    const result = await createPurchaseOrderBatch(body.data.batchDate);
    return NextResponse.json({
      batchDate: result.batchDate,
      createdCount: result.created.length,
      eligibleLineCount: result.eligibleLineCount,
      skippedUnmapped: result.skippedUnmapped,
      purchaseOrders: result.created.map((po) => ({
        poNumber: po.poNumber,
        supplierCode: po.supplier.code,
        lineCount: po.lines.length
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create PO batch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
