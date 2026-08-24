import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Returns | Sports Jersey House",
  description: "Returns and exchange information for Sports Jersey House made-to-order jerseys.",
  path: "/pages/returns"
});

export default function ReturnsPage() {
  return (
    <main className="page-shell policy-page">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>Returns &amp; exchanges</h1>
        <p>Most jerseys are made to order with your size and customisation, so they cannot be treated as standard off-the-shelf stock.</p>
      </div>
      <article className="policy-content">
        <h2>How to request help</h2>
        <p>
          Contact Sports Jersey House with your order number. We will review production status, the
          customisation on the order, and any fulfilment or quality issue recorded against it.
        </p>
        <h2>What we keep on the order</h2>
        <ul>
          <li>Custom name, number, and message</li>
          <li>Size and quantity</li>
          <li>Payment confirmation from Stripe</li>
          <li>Supplier purchase order and any tracking that has been submitted</li>
        </ul>
      </article>
    </main>
  );
}
