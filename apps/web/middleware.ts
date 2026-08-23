import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminAccessAllowed } from "@/lib/auth";
import { SUPPLIER_SESSION_COOKIE, isSupplierAccessAllowed } from "@/lib/supplier-auth";

function nextWithPath(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sjh-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonical admin aliases before auth so operators land on real routes after login.
  if (pathname === "/admin/tracking-exceptions") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/tracking/exceptions";
    return NextResponse.redirect(url);
  }
  if (pathname === "/admin/ops-jobs") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/jobs";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/supplier")) {
    if (pathname.startsWith("/supplier/login")) {
      return nextWithPath(request);
    }

    const token = request.cookies.get(SUPPLIER_SESSION_COOKIE)?.value;
    if (await isSupplierAccessAllowed(token)) {
      return nextWithPath(request);
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/supplier/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) {
      return nextWithPath(request);
    }

    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (await isAdminAccessAllowed(sessionToken)) {
      return nextWithPath(request);
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return nextWithPath(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
