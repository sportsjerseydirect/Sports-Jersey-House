import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertProductSupplierMapping } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const schema = z.object({
  productId: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierSku: z.string().trim().max(120).optional(),
  unitCostAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  isPrimary: z.boolean().optional()
});

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid supplier mapping." }, { status: 400 });
  }

  try {
    const mapping = await upsertProductSupplierMapping({
      productId: body.data.productId,
      supplierId: body.data.supplierId,
      ...(body.data.supplierSku !== undefined ? { supplierSku: body.data.supplierSku } : {}),
      ...(body.data.unitCostAmount !== undefined
        ? { unitCostAmount: body.data.unitCostAmount }
        : {}),
      ...(body.data.isPrimary !== undefined ? { isPrimary: body.data.isPrimary } : {})
    });
    return NextResponse.json({ mapping });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upsert mapping.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
