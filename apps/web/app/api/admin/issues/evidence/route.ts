import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addIssueEvidence } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

const schema = z.object({
  caseNumber: z.string().trim().min(1),
  kind: z.enum(["note", "url", "image", "file"]),
  label: z.string().trim().max(200).optional(),
  url: z.string().trim().url().optional(),
  notes: z.string().trim().max(2000).optional()
});

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid issue evidence." }, { status: 400 });
  }

  if (body.data.kind === "url" && !body.data.url) {
    return NextResponse.json({ error: "URL is required for url evidence." }, { status: 400 });
  }

  try {
    const evidence = await addIssueEvidence(body.data.caseNumber, {
      kind: body.data.kind,
      uploadedBy: "admin",
      ...(body.data.label !== undefined ? { label: body.data.label } : {}),
      ...(body.data.url !== undefined ? { url: body.data.url } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {})
    });
    return NextResponse.json({ evidence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add evidence.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
