import { Suspense } from "react";
import { AdminLoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="page-shell"><p className="lede">Loading…</p></main>}>
      <AdminLoginForm />
    </Suspense>
  );
}
