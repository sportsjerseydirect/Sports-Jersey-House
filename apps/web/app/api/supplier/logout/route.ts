import { NextResponse } from "next/server";
import { clearSupplierSessionCookieHeader } from "@/lib/supplier-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/supplier/login", request.url));
  response.headers.set("Set-Cookie", clearSupplierSessionCookieHeader());
  return response;
}
