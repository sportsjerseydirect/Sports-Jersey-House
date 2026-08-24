import type { Metadata } from "next";
import Link from "next/link";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Shipping | Sports Jersey House",
  description: "Shipping and delivery information for Sports Jersey House made-to-order jerseys.",
  path: "/pages/shipping"
});

export default function ShippingPage() {
  return (
    <main className="page-shell policy-page">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>Shipping</h1>
        <p>Jerseys are made to order. Delivery timing depends on production and the destination on your order.</p>
      </div>
      <article className="policy-content">
        <h2>What you pay at checkout</h2>
        <p>
          Stripe Checkout charges the Sports Jersey House order total calculated on our servers. There is no
          separate shipping line added on the Stripe payment page today.
        </p>
        <h2>After you pay</h2>
        <ul>
          <li>Paid orders are sent to a supplier as a purchase order</li>
          <li>Tracking and carrier details are stored on the order when the supplier dispatches</li>
          <li>Product pages show production/delivery expectations when that content exists on the listing</li>
        </ul>
        <p>
          See <Link href="/pages/returns">returns</Link> for made-to-order limitations.
        </p>
      </article>
    </main>
  );
}
