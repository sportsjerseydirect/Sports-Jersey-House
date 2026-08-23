import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  setAdminUserActive
} from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

async function requireAdmin(): Promise<NextResponse | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (await isAdminAccessAllowed(token)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  displayName: z.string().max(120).optional()
});

const patchSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(10).max(200).optional()
});

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid user payload." }, { status: 400 });
  }
  try {
    const user = await createAdminUser({
      email: body.data.email,
      password: body.data.password,
      ...(body.data.displayName ? { displayName: body.data.displayName } : {})
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  try {
    if (typeof body.data.isActive === "boolean") {
      await setAdminUserActive(body.data.userId, body.data.isActive);
    }
    if (body.data.newPassword) {
      await resetAdminUserPassword(body.data.userId, body.data.newPassword);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: 400 }
    );
  }
}
