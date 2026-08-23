"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hide storefront marketing chrome on admin and supplier operational surfaces. */
export function StorefrontOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin") || pathname.startsWith("/supplier")) {
    return null;
  }
  return <>{children}</>;
}
