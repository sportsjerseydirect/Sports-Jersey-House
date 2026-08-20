import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "./login-form";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Admin Login | Sports Jersey House",
  description: "Sign in to the Sports Jersey House admin console.",
  path: "/admin/login",
  noIndex: true
});

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="page-shell"><p className="lede">Loading…</p></main>}>
      <AdminLoginForm />
    </Suspense>
  );
}
