"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login" as Route);
    router.refresh();
  }

  return (
    <button className="button secondary admin-logout" type="button" onClick={handleLogout}>
      Sign out
    </button>
  );
}
