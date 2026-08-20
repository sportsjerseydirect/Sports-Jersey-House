import { loadCart } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";

export async function SiteHeaderShell() {
  let cartLabel = "Cart";

  try {
    const cart = await loadCart();
    cartLabel = cart.itemCount > 0 ? `Cart (${cart.itemCount})` : "Cart";
  } catch (error) {
    console.warn(
      "[header] cart unavailable:",
      error instanceof Error ? error.message : error
    );
  }

  return <SiteHeader cartLabel={cartLabel} />;
}
