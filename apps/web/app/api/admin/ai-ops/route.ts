import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isReadOnlyOpsAction, parseOpsIntent } from "@sjh/ai";
import {
  confirmOpsAction,
  createOpsAuditPreview,
  rejectOpsAction
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const previewSchema = z.object({
  prompt: z.string().trim().min(1).max(20_000)
});

const confirmSchema = z.object({
  auditId: z.string().uuid(),
  decision: z.enum(["confirm", "reject"])
});

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = previewSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Prompt required." }, { status: 400 });
  }

  try {
    const intent = parseOpsIntent(body.data.prompt);
    if (!intent) {
      return NextResponse.json(
        {
          error:
            "Could not understand that request. Try: create PO batch, ingest tracking, ageing orders, margin report, chase PO-…, or open issue on SJH-…"
        },
        { status: 400 }
      );
    }

    const audit = await createOpsAuditPreview({
      actionType: intent.actionType,
      requiresConfirmation: intent.requiresConfirmation,
      inputPayload: intent.input,
      previewPayload: {
        summary: intent.previewSummary,
        confidence: intent.confidence,
        prompt: body.data.prompt
      },
      executeImmediately: isReadOnlyOpsAction(intent.actionType) && !intent.requiresConfirmation
    });

    return NextResponse.json({ intent, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to preview action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = confirmSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  }

  try {
    const audit =
      body.data.decision === "confirm"
        ? await confirmOpsAction(body.data.auditId, "admin")
        : await rejectOpsAction(body.data.auditId, "admin");
    return NextResponse.json({ audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
