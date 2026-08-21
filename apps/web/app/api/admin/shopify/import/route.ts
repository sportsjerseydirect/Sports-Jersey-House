import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createImportRun,
  getShopifyConnectionHealth,
  listImportRuns,
  stageNormalizedProduct
} from "@sjh/database";
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

  try {
    // Stage only — never live Shopify fetch here. Sync remains gated.
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
        health.syncEnabled
          ? "Import run created (stage only from this endpoint; live fetch not invoked)."
          : "Sync gated — staged optional sampleProducts only; no live Shopify API call."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create import run.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
