import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listTrackingExceptions, resolveTrackingException } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const resolveSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["resolved", "ignored"]),
  notes: z.string().trim().max(2000).optional()
});

export async function GET() {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  try {
    const exceptions = await listTrackingExceptions("open");
    return NextResponse.json({ exceptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list exceptions.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) {
    return denied;
  }

  const body = resolveSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid exception resolve payload." }, { status: 400 });
  }

  try {
    const exception = await resolveTrackingException(body.data.id, {
      status: body.data.status,
      resolvedBy: "admin",
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {})
    });
    return NextResponse.json({ exception });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve exception.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
