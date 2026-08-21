import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  calibrateAndApplyPendingChanges,
  decideAiChange,
  getAiAgentStatus,
  listPendingAiChanges,
  listRecentAiChanges,
  runSimplifiedCatalogueAgent,
  setAiAgentAutonomousEnabled
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [status, pending, recent] = await Promise.all([
    getAiAgentStatus(),
    listPendingAiChanges(40),
    listRecentAiChanges(40)
  ]);

  return NextResponse.json({ status, pending, recent });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = z
    .object({
      action: z.enum(["run_agent", "set_global_autonomous", "decide_change", "calibrate_and_apply"]),
      enabled: z.boolean().optional(),
      changeId: z.string().uuid().optional(),
      decision: z.enum(["approved", "rejected"]).optional(),
      limit: z.number().int().min(1).max(600).optional()
    })
    .safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.data.action === "run_agent") {
      const result = await runSimplifiedCatalogueAgent({ limit: body.data.limit ?? 80 });
      const status = await getAiAgentStatus();
      return NextResponse.json({ ok: true, result, status });
    }

    if (body.data.action === "calibrate_and_apply") {
      const result = await calibrateAndApplyPendingChanges();
      return NextResponse.json({ ok: true, result, status: result.status });
    }

    if (body.data.action === "set_global_autonomous") {
      if (body.data.enabled === undefined) {
        return NextResponse.json({ error: "enabled required." }, { status: 400 });
      }
      const status = await setAiAgentAutonomousEnabled(body.data.enabled, "admin");
      return NextResponse.json({ ok: true, status });
    }

    if (!body.data.changeId || !body.data.decision) {
      return NextResponse.json({ error: "changeId and decision required." }, { status: 400 });
    }

    const decided = await decideAiChange({
      changeId: body.data.changeId,
      decision: body.data.decision,
      actor: "admin"
    });
    const status = await getAiAgentStatus();
    return NextResponse.json({ ok: true, decided, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalogue agent action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
