import { headers } from "next/headers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { ShoppingAssistantWidget } from "@/components/shopping-assistant-widget";
import { WelcomeLeadCapture } from "@/components/welcome-lead-capture";

function isOpsPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/supplier");
}

/**
 * Server-side gate so storefront chrome (header/footer/lead popup/AI widget)
 * is never rendered into admin or supplier HTML — including SSR.
 */
export async function StorefrontChrome() {
  const headerList = await headers();
  const pathname =
    headerList.get("x-sjh-pathname") ||
    safePathname(headerList.get("next-url")) ||
    safePathname(headerList.get("x-url")) ||
    "";

  if (isOpsPath(pathname)) {
    return null;
  }

  return (
    <>
      <SiteHeaderShell />
    </>
  );
}

export async function StorefrontFooterChrome() {
  const headerList = await headers();
  const pathname =
    headerList.get("x-sjh-pathname") ||
    safePathname(headerList.get("next-url")) ||
    safePathname(headerList.get("x-url")) ||
    "";

  if (isOpsPath(pathname)) {
    return null;
  }

  return (
    <>
      <SiteFooter />
      <WelcomeLeadCapture />
      <ShoppingAssistantWidget />
    </>
  );
}

function safePathname(value: string | null): string {
  if (!value) return "";
  try {
    if (value.startsWith("/")) return value.split("?")[0] ?? value;
    return new URL(value).pathname;
  } catch {
    return "";
  }
}
