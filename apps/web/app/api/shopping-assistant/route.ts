import { runShoppingAssistantTurn } from "@sjh/ai";
import { z } from "zod";
import { featureFlags } from "@/lib/env";
import { getSearchProvider } from "@/lib/search";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(2000)
});

export async function POST(request: Request) {
  if (!featureFlags.enableAiShoppingAssistant) {
    return Response.json(
      {
        ok: false,
        error: "SJH AI shopping assistant is disabled. Set ENABLE_AI_SHOPPING_ASSISTANT=true to enable."
      },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const search = getSearchProvider();
  const result = await runShoppingAssistantTurn(parsed.data.message, {
    search: (req) => search.search(req),
    getProductBySlug: (slug) => search.getProductBySlug(slug)
  });

  return Response.json({ ok: true, ...result });
}
