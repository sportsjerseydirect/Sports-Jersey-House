import { ADMIN_SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      }
    }
  );
}
