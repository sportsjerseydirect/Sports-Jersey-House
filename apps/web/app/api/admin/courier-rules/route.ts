import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCourierRule, setCourierRuleActive, updateCourierRule } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  pattern: z.string().trim().min(1).max(200),
  patternType: z.enum(["regex", "prefix", "contains"]).optional(),
  courierCode: z.string().trim().min(1).max(40),
  courierName: z.string().trim().min(1).max(120),
  priority: z.number().int().min(1).max(10_000).optional(),
  notes: z.string().trim().max(500).optional()
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  pattern: z.string().trim().min(1).max(200).optional(),
  patternType: z.enum(["regex", "prefix", "contains"]).optional(),
  courierCode: z.string().trim().min(1).max(40).optional(),
  courierName: z.string().trim().min(1).max(120).optional(),
  priority: z.number().int().min(1).max(10_000).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid courier rule." }, { status: 400 });
  }

  try {
    const rule = await createCourierRule({
      name: body.data.name,
      pattern: body.data.pattern,
      courierCode: body.data.courierCode,
      courierName: body.data.courierName,
      ...(body.data.patternType ? { patternType: body.data.patternType } : {}),
      ...(body.data.priority !== undefined ? { priority: body.data.priority } : {}),
      ...(body.data.notes ? { notes: body.data.notes } : {})
    });
    return NextResponse.json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create rule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid courier rule update." }, { status: 400 });
  }

  try {
    const { id, isActive, ...fields } = body.data;
    let rule =
      Object.keys(fields).length > 0
        ? await updateCourierRule(id, {
            ...(fields.name !== undefined ? { name: fields.name } : {}),
            ...(fields.pattern !== undefined ? { pattern: fields.pattern } : {}),
            ...(fields.patternType !== undefined ? { patternType: fields.patternType } : {}),
            ...(fields.courierCode !== undefined ? { courierCode: fields.courierCode } : {}),
            ...(fields.courierName !== undefined ? { courierName: fields.courierName } : {}),
            ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
            ...(fields.notes !== undefined ? { notes: fields.notes } : {})
          })
        : null;

    if (isActive !== undefined) {
      rule = await setCourierRuleActive(id, isActive);
    }

    if (!rule) {
      rule = await updateCourierRule(id, {});
    }

    return NextResponse.json({ rule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update rule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
