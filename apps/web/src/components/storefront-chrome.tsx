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
  const pathname = (await headers()).get("x-sjh-pathname") ?? "";
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
  const pathname = (await headers()).get("x-sjh-pathname") ?? "";
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
