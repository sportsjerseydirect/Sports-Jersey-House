import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupplier,
  ensureDefaultSupplierMappings
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

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = createSupplierSchema.safeParse(await request.json());
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
