import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runDailyPoBatchJob,
  runMarginCostRefreshJob,
  runOpsExceptionDetectionJob,
  runSupplierTrackingRequestJob,
  runTrackingIngestCheckJob,
  type OpsJobType
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const EMAIL_RELATED_JOBS = new Set<OpsJobType>(["supplier_tracking_request"]);

const schema = z.object({
  jobType: z.enum([
    "daily_po_batch",
    "supplier_tracking_request",
    "tracking_ingest_check",
    "ops_exception_detection",
    "margin_cost_refresh"
  ]),
  dryRun: z.boolean().optional()
});

function resolveDryRun(jobType: OpsJobType, requested?: boolean): boolean {
  // Default true. Never allow live run for email-related jobs (external send stays disabled).
  if (EMAIL_RELATED_JOBS.has(jobType)) {
    return true;
  }
  return requested === false ? false : true;
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid job run request." }, { status: 400 });
  }

  const dryRun = resolveDryRun(body.data.jobType, body.data.dryRun);

  try {
    switch (body.data.jobType) {
      case "daily_po_batch": {
        const result = await runDailyPoBatchJob({ dryRun });
        return NextResponse.json(result);
      }
      case "margin_cost_refresh": {
        const result = await runMarginCostRefreshJob({ dryRun });
        return NextResponse.json(result);
      }
      case "ops_exception_detection": {
        const result = await runOpsExceptionDetectionJob({ dryRun });
        return NextResponse.json(result);
      }
      case "supplier_tracking_request": {
        const result = await runSupplierTrackingRequestJob({ dryRun: true });
        return NextResponse.json(result);
      }
      case "tracking_ingest_check": {
        const result = await runTrackingIngestCheckJob({ dryRun });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unsupported job type." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
