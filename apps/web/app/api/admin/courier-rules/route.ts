import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCourierRule } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  pattern: z.string().trim().min(1).max(200),
  patternType: z.enum(["regex", "prefix", "contains"]).optional(),
  courierCode: z.string().trim().min(1).max(40),
  courierName: z.string().trim().min(1).max(120),
  priority: z.number().int().min(1).max(10_000).optional(),
  notes: z.string().trim().max(500).optional()
});

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
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
