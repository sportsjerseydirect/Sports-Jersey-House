import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getShopifyConnectionHealth } from "@sjh/database";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

export async function GET() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isAdminAccessAllowed(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ health: getShopifyConnectionHealth() });
}
