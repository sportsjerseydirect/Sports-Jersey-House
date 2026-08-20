import { loadCart } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";

export async function SiteHeaderShell() {
  const cart = await loadCart();
  const cartLabel = cart.itemCount > 0 ? `Cart (${cart.itemCount})` : "Cart";

  return <SiteHeader cartLabel={cartLabel} />;
}
