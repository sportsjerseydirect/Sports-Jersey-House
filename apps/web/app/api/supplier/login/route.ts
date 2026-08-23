import { NextResponse } from "next/server";
import {
  createSupplierSessionToken,
  supplierSessionCookieHeader
} from "@/lib/supplier-auth";
import { getSupplierUserByEmail, hashSupplierPassword, verifySupplierLogin } from "@sjh/database";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let email = "";
  let password = "";
  let next = "/supplier";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { email?: string; password?: string; next?: string };
    email = body.email ?? "";
    password = body.password ?? "";
    next = body.next ?? "/supplier";
  } else {
    const form = await request.formData();
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
    next = String(form.get("next") ?? "/supplier");
  }

  const user = await getSupplierUserByEmail(email);
  if (!user || !(await verifySupplierLogin(email, password, user.passwordDigest))) {
    const login = new URL("/supplier/login", request.url);
    login.searchParams.set("error", "Invalid email or password.");
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  const token = await createSupplierSessionToken({
    supplierId: user.supplierId,
    supplierUserId: user.id,
    email: user.email,
    supplierName: user.supplierName
  });

  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Set-Cookie", supplierSessionCookieHeader(token));
  return response;
}

// Dev bootstrap helper — hash only, no auth
export async function PUT(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available." }, { status: 403 });
  }
  const body = (await request.json()) as { password?: string };
  if (!body.password) {
    return NextResponse.json({ ok: false, error: "password required" }, { status: 400 });
  }
  const digest = await hashSupplierPassword(body.password);
  return NextResponse.json({ ok: true, digest });
}
