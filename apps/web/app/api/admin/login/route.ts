import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword
} from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const loginSchema = z.object({
  password: z.string().min(1),
  next: z.string().optional()
});

function sanitizeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/admin";
  }

  return next;
}

function loginRedirect(request: Request, next: string, error: string): NextResponse {
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("error", error);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export async function POST(request: Request) {
  const limited = rateLimit(`admin-login:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 60_000
  });

  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const contentType = request.headers.get("content-type") ?? "";
  let password = "";
  let next = "/admin";

  if (contentType.includes("application/json")) {
    const body = loginSchema.safeParse(await request.json());

    if (!body.success) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    password = body.data.password;
    next = sanitizeNextPath(body.data.next);
  } else {
    const form = await request.formData();
    password = String(form.get("password") ?? "");
    next = sanitizeNextPath(String(form.get("next") ?? "/admin"));
  }

  if (!password) {
    if (contentType.includes("application/json")) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    return loginRedirect(request, next, "Invalid password.");
  }

  if (!verifyAdminPassword(password)) {
    if (contentType.includes("application/json")) {
      return Response.json({ error: "Invalid credentials." }, { status: 401 });
    }

    return loginRedirect(request, next, "Invalid password.");
  }

  const token = await createAdminSessionToken();
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());

  return response;
}
