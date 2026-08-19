import type { Metadata } from "next";
import Link from "next/link";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Cart | Sports Jersey House",
  description: "Your shopping cart at Sports Jersey House.",
  path: "/cart"
});

export default function CartPage() {
  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Cart</p>
        <h1>Your cart</h1>
        <p>Checkout architecture is being built. Cart persistence will connect to PostgreSQL and Stripe.</p>
      </div>
      <section className="empty-state">
        <h2>Cart is empty</h2>
        <p>Browse the catalogue while we prepare secure checkout.</p>
        <div className="actions">
          <Link className="button primary" href="/products">
            Shop products
          </Link>
        </div>
      </section>
    </main>
  );
}
