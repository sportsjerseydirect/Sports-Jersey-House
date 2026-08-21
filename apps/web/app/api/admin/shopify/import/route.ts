import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createImportRun,
  getShopifyConnectionHealth,
  listImportRuns,
  stageNormalizedProduct
} from "@sjh/database";
import { runControlledSampleImport } from "@sjh/shopify";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const sampleProductSchema = z.object({
  shopifyProductId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  handle: z.string().trim().min(1),
  status: z.string().trim().min(1).default("draft"),
  vendor: z.string().trim().optional(),
  productType: z.string().trim().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  normalized: z.record(z.string(), z.unknown()).optional()
});

const postSchema = z.object({
  action: z.enum(["stage", "run_sample"]).default("stage"),
  mode: z.enum(["dry_run", "sample"]).default("dry_run"),
  sampleLimit: z.number().int().min(1).max(100).optional(),
  sampleProducts: z.array(sampleProductSchema).max(50).optional()
});

export async function GET() {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  try {
    const runs = await listImportRuns(50);
    return NextResponse.json({ runs, health: getShopifyConnectionHealth() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list import runs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = postSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }

  const health = getShopifyConnectionHealth();

  if (body.data.action === "run_sample") {
    if (process.env.ENABLE_SHOPIFY_SAMPLE_IMPORT !== "true") {
      return NextResponse.json(
        {
          error:
            "Controlled sample import requires ENABLE_SHOPIFY_SAMPLE_IMPORT=true (full ENABLE_SHOPIFY_SYNC is not required and should stay off unless approved).",
          health
        },
        { status: 403 }
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL is required.", health }, { status: 400 });
    }

    try {
      const report = await runControlledSampleImport({
        databaseUrl,
        ...(body.data.sampleLimit !== undefined ? { sampleLimit: body.data.sampleLimit } : {})
      });
      return NextResponse.json({ report, health });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sample import failed.";
      return NextResponse.json({ error: message, health }, { status: 400 });
    }
  }

  try {
    // Stage only — never live Shopify fetch here unless action=run_sample.
    const run = await createImportRun({
      mode: body.data.mode,
      ...(body.data.sampleLimit !== undefined ? { sampleLimit: body.data.sampleLimit } : {})
    });

    const staged = [];
    const samples = body.data.sampleProducts ?? [];

    if (health.status === "gated" || health.status === "missing_credentials") {
      for (const sample of samples) {
        const payload = sample.payload ?? {
          id: sample.shopifyProductId,
          title: sample.title,
          handle: sample.handle,
          status: sample.status
        };
        const normalized = sample.normalized ?? {
          title: sample.title,
          handle: sample.handle,
          status: sample.status
        };
        staged.push(
          await stageNormalizedProduct(run.id, {
            shopifyProductId: sample.shopifyProductId,
            title: sample.title,
            handle: sample.handle,
            status: sample.status,
            payload,
            normalized,
            ...(sample.vendor ? { vendor: sample.vendor } : {}),
            ...(sample.productType ? { productType: sample.productType } : {})
          })
        );
      }
    } else if (samples.length > 0) {
      for (const sample of samples) {
        staged.push(
          await stageNormalizedProduct(run.id, {
            shopifyProductId: sample.shopifyProductId,
            title: sample.title,
            handle: sample.handle,
            status: sample.status,
            payload: sample.payload ?? { id: sample.shopifyProductId, title: sample.title },
            normalized: sample.normalized ?? { title: sample.title, handle: sample.handle },
            ...(sample.vendor ? { vendor: sample.vendor } : {}),
            ...(sample.productType ? { productType: sample.productType } : {})
          })
        );
      }
    }

    return NextResponse.json({
      run,
      health,
      staged,
      note:
        health.status === "ready"
          ? "Import run created (stage only from this endpoint; use action=run_sample for controlled live sample import)."
          : "Sync/sample gated — staged optional sampleProducts only; no live Shopify API call."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create import run.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
