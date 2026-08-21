import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyMappedSupplierCosts, updateOrderItemCosts } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/);

const updateSchema = z.object({
  orderItemId: z.string().uuid(),
  supplierCostAmount: money.optional(),
  customisationCostAmount: money.optional(),
  fulfilmentCostAmount: money.optional(),
  otherCostAmount: money.optional()
});

const applySchema = z.object({
  orderNumber: z.string().trim().min(1)
});

export async function PATCH(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid cost update." }, { status: 400 });
  }

  try {
    const { orderItemId, ...rawCosts } = body.data;
    await updateOrderItemCosts(orderItemId, {
      ...(rawCosts.supplierCostAmount !== undefined
        ? { supplierCostAmount: rawCosts.supplierCostAmount }
        : {}),
      ...(rawCosts.customisationCostAmount !== undefined
        ? { customisationCostAmount: rawCosts.customisationCostAmount }
        : {}),
      ...(rawCosts.fulfilmentCostAmount !== undefined
        ? { fulfilmentCostAmount: rawCosts.fulfilmentCostAmount }
        : {}),
      ...(rawCosts.otherCostAmount !== undefined ? { otherCostAmount: rawCosts.otherCostAmount } : {})
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update costs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = applySchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Order number required." }, { status: 400 });
  }

  try {
    const updated = await applyMappedSupplierCosts(body.data.orderNumber);
    return NextResponse.json({ updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply mapped costs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
