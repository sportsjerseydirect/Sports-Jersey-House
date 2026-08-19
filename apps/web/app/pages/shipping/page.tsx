import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Shipping | Sports Jersey House",
  description: "Shipping information for Sports Jersey House orders.",
  path: "/pages/shipping"
});

export default function ShippingPage() {
  return (
    <main className="page-shell policy-page">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>Shipping</h1>
        <p>Shipping rates and delivery timelines will be published before checkout goes live.</p>
      </div>
      <article className="policy-content">
        <h2>Current status</h2>
        <p>
          Sports Jersey House is under active development. Checkout and fulfilment are not yet available on this
          platform.
        </p>
        <h2>What to expect at launch</h2>
        <ul>
          <li>Transparent delivery estimates shown before purchase</li>
          <li>Tracked shipping for domestic and international orders</li>
          <li>Clear handling times for made-to-order or imported inventory</li>
        </ul>
      </article>
    </main>
  );
}
