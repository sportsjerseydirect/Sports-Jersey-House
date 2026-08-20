import { SiteHeader } from "@/components/site-header";

/** Header shell stays sync so ISR product/collection pages are not forced dynamic via cookies(). */
export function SiteHeaderShell() {
  return <SiteHeader />;
}
