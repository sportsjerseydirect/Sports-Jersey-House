import { z } from "zod";
import {
  adminSessionCookieHeader,
  createAdminSessionToken,
  verifyAdminPassword
} from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const loginSchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const limited = rateLimit(`admin-login:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

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
        "Set-Cookie": adminSessionCookieHeader(token)
      }
    }
  );
}
