import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (await isAdminAccessAllowed(sessionToken)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"]
};
