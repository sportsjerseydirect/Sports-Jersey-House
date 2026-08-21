import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestTrackingPaste } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const schema = z.object({
  paste: z.string().min(1).max(50_000)
});

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Paste text is required." }, { status: 400 });
  }

  try {
    const result = await ingestTrackingPaste(body.data.paste);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest tracking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
