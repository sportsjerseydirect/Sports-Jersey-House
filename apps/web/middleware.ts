import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";
import { SUPPLIER_SESSION_COOKIE, isSupplierAccessAllowed } from "@/lib/supplier-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/supplier")) {
    if (pathname.startsWith("/supplier/login")) {
      return NextResponse.next();
    }

    const token = request.cookies.get(SUPPLIER_SESSION_COOKIE)?.value;
    if (await isSupplierAccessAllowed(token)) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/supplier/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

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
  matcher: ["/admin/:path*", "/supplier/:path*"]
};
