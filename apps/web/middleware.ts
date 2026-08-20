import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sjh-pathname", pathname);

  const passThrough = () =>
    NextResponse.next({
      request: { headers: requestHeaders }
    });

  if (!pathname.startsWith("/admin")) {
    return passThrough();
  }

  if (pathname.startsWith("/admin/login")) {
    return passThrough();
  }

  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (await isAdminAccessAllowed(sessionToken)) {
    return passThrough();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"]
};
