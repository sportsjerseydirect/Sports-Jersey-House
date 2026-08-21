import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createIssueCase, updateIssueCase } from "@sjh/database";
import { issueReasonSchema, issueStatusSchema } from "@sjh/shared";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const createSchema = z.object({
  orderNumber: z.string().trim().min(1),
  orderItemId: z.string().uuid().optional(),
  reason: issueReasonSchema,
  customerNotes: z.string().trim().max(2000).optional(),
  internalNotes: z.string().trim().max(2000).optional()
});

const updateSchema = z.object({
  caseNumber: z.string().trim().min(1),
  status: issueStatusSchema.optional(),
  decision: z.string().trim().max(2000).optional(),
  resolution: z.string().trim().max(2000).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  customerNotes: z.string().trim().max(2000).optional(),
  supplierResponsibility: z.boolean().optional(),
  replacementCostAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  replacementOrderNumber: z.string().trim().min(1).optional()
});

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid issue case." }, { status: 400 });
  }

  try {
    const issue = await createIssueCase({
      orderNumber: body.data.orderNumber,
      reason: body.data.reason,
      ...(body.data.orderItemId ? { orderItemId: body.data.orderItemId } : {}),
      ...(body.data.customerNotes ? { customerNotes: body.data.customerNotes } : {}),
      ...(body.data.internalNotes ? { internalNotes: body.data.internalNotes } : {})
    });
    return NextResponse.json({ issue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create issue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = updateSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid issue update." }, { status: 400 });
  }

  try {
    const { caseNumber, ...raw } = body.data;
    const issue = await updateIssueCase(caseNumber, {
      ...(raw.status ? { status: raw.status } : {}),
      ...(raw.decision !== undefined ? { decision: raw.decision } : {}),
      ...(raw.resolution !== undefined ? { resolution: raw.resolution } : {}),
      ...(raw.internalNotes !== undefined ? { internalNotes: raw.internalNotes } : {}),
      ...(raw.customerNotes !== undefined ? { customerNotes: raw.customerNotes } : {}),
      ...(raw.supplierResponsibility !== undefined
        ? { supplierResponsibility: raw.supplierResponsibility }
        : {}),
      ...(raw.replacementCostAmount !== undefined
        ? { replacementCostAmount: raw.replacementCostAmount }
        : {}),
      ...(raw.replacementOrderNumber !== undefined
        ? { replacementOrderNumber: raw.replacementOrderNumber }
        : {})
    });
    return NextResponse.json({ issue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update issue.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
