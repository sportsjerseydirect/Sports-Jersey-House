import { z } from "zod";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, verifyAdminPassword } from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const body = loginSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!verifyAdminPassword(body.data.password)) {
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createAdminSessionToken();

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      }
    }
  );
}
