import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  OPS_TOOL_DEFINITIONS,
  parseOpsIntent,
  parseOpsIntentV2,
  type OpsToolName
} from "@sjh/ai";
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

/** Map V2 tool names onto createOpsAuditPreview / executeOpsAction actionTypes. */
function mapToolToActionType(toolName: OpsToolName): string {
  switch (toolName) {
    case "create_po_batch":
      return "create_po_batch";
    case "update_tracking":
      return "ingest_tracking";
    case "identify_courier":
      return "identify_courier";
    case "update_supplier_cost":
      return "update_supplier_cost";
    case "calculate_margin":
      return "margin_report";
    case "create_issue_case":
      return "create_issue_case";
    case "prepare_replacement":
      return "prepare_replacement";
    case "prepare_supplier_email":
      return "draft_supplier_chase_email";
    case "prepare_customer_email":
      return "prepare_customer_email";
    case "inspect_catalogue":
      return "inspect_catalogue";
    default:
      return toolName;
  }
}

function isPrepareTool(toolName: OpsToolName): boolean {
  return toolName.startsWith("prepare_");
}

function isImmediateReadTool(toolName: OpsToolName): boolean {
  return (
    toolName === "identify_courier" ||
    toolName === "calculate_margin" ||
    toolName === "inspect_catalogue" ||
    toolName === "attention_today" ||
    toolName === "list_tracking_overdue" ||
    toolName === "list_delivery_overdue" ||
    toolName === "list_low_margin_orders" ||
    toolName === "list_poor_seo" ||
    toolName === "list_chargeback_risk"
  );
}

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
    const v2 = parseOpsIntentV2(body.data.prompt);

    if (v2) {
      const actionType = mapToolToActionType(v2.toolName);
      const prepareOnly = isPrepareTool(v2.toolName);
      // prepare_* stay preview-only — never confirm/execute or send.
      const requiresConfirmation = prepareOnly ? false : v2.requiresConfirmation;
      const executeImmediately =
        !prepareOnly && !requiresConfirmation && isImmediateReadTool(v2.toolName);

      const toolDef = OPS_TOOL_DEFINITIONS.find((tool) => tool.name === v2.toolName);

      const audit = await createOpsAuditPreview({
        actionType,
        requiresConfirmation,
        inputPayload: v2.args,
        previewPayload: {
          summary: v2.previewSummary,
          toolName: v2.toolName,
          risk: toolDef?.risk ?? "write",
          prepareOnly,
          prompt: body.data.prompt,
          note: prepareOnly
            ? "Preview-only prepare tool — never sends email or applies financial writes."
            : undefined
        },
        executeImmediately
      });

      return NextResponse.json({
        intent: {
          toolName: v2.toolName,
          actionType,
          input: v2.args,
          requiresConfirmation,
          previewSummary: v2.previewSummary,
          confidence: "high" as const
        },
        tools: OPS_TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          risk: tool.risk,
          requiresConfirmation: tool.requiresConfirmation
        })),
        audit
      });
    }

    // Fall back for ageing / legacy-only intents not covered by V2 tools.
    const intent = parseOpsIntent(body.data.prompt);
    if (!intent) {
      return NextResponse.json(
        {
          error:
            "Could not understand that request. Try: create PO batch, ingest tracking, ageing orders, margin report, chase PO-…, inspect catalogue, or open issue on SJH-…"
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
      executeImmediately: !intent.requiresConfirmation
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
