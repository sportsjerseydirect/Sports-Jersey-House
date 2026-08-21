import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureSeoRecordForProduct,
  evaluateProductReadiness,
  listCatalogueProductsForAdmin,
  transitionProductStatus,
  type ProductWorkflowAction
} from "@sjh/database";
import { productStatusSchema } from "@sjh/shared";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const actionSchema = z.object({
  productId: z.string().uuid(),
  action: z.enum([
    "send_to_review",
    "approve",
    "publish",
    "reject_to_draft",
    "archive"
  ]),
  forcePublishDespiteWarnings: z.boolean().optional()
});

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const shopifyOnly = url.searchParams.get("shopifyOnly") === "true";
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((value) => productStatusSchema.safeParse(value.trim()))
        .filter((result) => result.success)
        .map((result) => result.data)
    : undefined;

  const products = await listCatalogueProductsForAdmin({
    ...(statuses?.length ? { status: statuses } : {}),
    shopifyOnly,
    limit: 100
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = actionSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid workflow request." }, { status: 400 });
  }

  try {
    if (body.data.action === "publish") {
      await ensureSeoRecordForProduct(body.data.productId);
    }

    const result = await transitionProductStatus({
      productId: body.data.productId,
      action: body.data.action as ProductWorkflowAction,
      actor: "admin",
      ...(body.data.forcePublishDespiteWarnings !== undefined
        ? { forcePublishDespiteWarnings: body.data.forcePublishDespiteWarnings }
        : {})
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow transition failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = z.object({ productId: z.string().uuid() }).safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "productId required." }, { status: 400 });
  }

  try {
    const readiness = await evaluateProductReadiness(body.data.productId);
    return NextResponse.json({ readiness });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to evaluate readiness.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
