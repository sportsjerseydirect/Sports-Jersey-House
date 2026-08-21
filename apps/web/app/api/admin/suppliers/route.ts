import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupplier,
  ensureDefaultSupplierMappings,
  setSupplierActive,
  updateSupplier,
  upsertProductSupplierMapping
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const createSupplierSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional()
});

const patchSupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  packingSlipFormat: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional()
});

const mappingViaActionSchema = z.object({
  action: z.literal("upsert_mapping"),
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
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const json = await request.json();
  const mappingBody = mappingViaActionSchema.safeParse(json);
  if (mappingBody.success) {
    try {
      const mapping = await upsertProductSupplierMapping({
        productId: mappingBody.data.productId,
        supplierId: mappingBody.data.supplierId,
        ...(mappingBody.data.supplierSku !== undefined
          ? { supplierSku: mappingBody.data.supplierSku }
          : {}),
        ...(mappingBody.data.unitCostAmount !== undefined
          ? { unitCostAmount: mappingBody.data.unitCostAmount }
          : {}),
        ...(mappingBody.data.isPrimary !== undefined
          ? { isPrimary: mappingBody.data.isPrimary }
          : {})
      });
      return NextResponse.json({ mapping });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upsert mapping.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const body = createSupplierSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "Invalid supplier." }, { status: 400 });
  }

  try {
    const supplier = await createSupplier({
      code: body.data.code,
      name: body.data.name,
      ...(body.data.email ? { email: body.data.email } : {}),
      ...(body.data.phone ? { phone: body.data.phone } : {})
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create supplier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = patchSupplierSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid supplier update." }, { status: 400 });
  }

  try {
    const { id, isActive, ...fields } = body.data;
    let supplier =
      Object.keys(fields).length > 0
        ? await updateSupplier(id, {
            ...(fields.name !== undefined ? { name: fields.name } : {}),
            ...(fields.email !== undefined ? { email: fields.email } : {}),
            ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
            ...(fields.packingSlipFormat !== undefined
              ? { packingSlipFormat: fields.packingSlipFormat }
              : {})
          })
        : null;

    if (isActive !== undefined) {
      supplier = await setSupplierActive(id, isActive);
    }

    if (!supplier) {
      supplier = await updateSupplier(id, {});
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update supplier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT() {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  try {
    const result = await ensureDefaultSupplierMappings();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to bootstrap supplier.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
