import type { Route } from "next";
import Link from "next/link";
import { loadCart } from "@/lib/cart";

export async function CartNavLink() {
  const cart = await loadCart();

  return (
    <Link href={"/cart" as Route}>
      Cart{cart.itemCount > 0 ? ` (${cart.itemCount})` : ""}
    </Link>
  );
}
