"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Compact ops chrome for authenticated admin pages (no storefront marketing). */
export function AdminShellNav() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin/login")) {
    return null;
  }

  const links: Array<{ href: Route; label: string }> = [
    { href: "/admin" as Route, label: "Command Centre" },
    { href: "/admin/orders" as Route, label: "Orders" },
    { href: "/admin/purchase-orders" as Route, label: "POs" },
    { href: "/admin/suppliers" as Route, label: "Suppliers" },
    { href: "/admin/catalogue/products" as Route, label: "Catalogue" },
    { href: "/admin/issues" as Route, label: "Issues" },
    { href: "/admin/ai-ops" as Route, label: "AI Ops" },
    { href: "/admin/jobs" as Route, label: "Jobs" }
  ];

  return (
    <nav aria-label="Admin navigation" className="admin-shell-nav">
      <div className="admin-shell-nav__inner">
        <p className="admin-shell-nav__brand">SJH Admin</p>
        <ul className="admin-shell-nav__list">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

