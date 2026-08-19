import { buildHealthPayload } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildHealthPayload();
  const status = payload.status === "ok" ? 200 : 503;

  return Response.json(payload, { status });
}
