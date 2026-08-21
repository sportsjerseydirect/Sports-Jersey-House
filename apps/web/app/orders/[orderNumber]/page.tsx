import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCustomisationSummary } from "@sjh/shared";
import { getOrderByNumber } from "@sjh/database";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

type OrderPageProps = {
  params: Promise<{ orderNumber: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return createMetadata({
    title: `Order ${decodeURIComponent(orderNumber)} | Sports Jersey House`,
    description: "Order confirmation for Sports Jersey House.",
    path: `/orders/${orderNumber}`,
    noIndex: true
  });
}

export default async function OrderConfirmationPage({ params }: OrderPageProps) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw);
  const order = await getOrderByNumber(orderNumber);

  if (!order) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Order confirmed</p>
        <h1>{order.orderNumber}</h1>
        <p>
          Thanks{order.shippingAddress?.fullName ? `, ${order.shippingAddress.fullName}` : ""}. Your order is recorded
          as <strong>{order.status.replaceAll("_", " ")}</strong>. Stripe payment will connect in a later phase.
        </p>
      </div>

      <section className="order-confirmation" aria-label="Order details">
        <article className="status-panel">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{order.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{order.phone}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatProductPrice(order.totalAmount, order.currencyCode)}</dd>
            </div>
            <div>
              <dt>Fulfilment</dt>
              <dd>{order.fulfilmentStatus.replaceAll("_", " ")}</dd>
            </div>
          </dl>
        </article>

        {order.shippingAddress ? (
          <article className="status-panel">
            <h2>Ship to</h2>
            <p>
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              ) : null}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
            </p>
          </article>
        ) : null}

        <article className="status-panel">
          <h2>Items</h2>
          <ul className="order-lines">
            {order.items.map((item) => {
              const customisationSummary = formatCustomisationSummary(item.customisation);
              return (
                <li key={item.id}>
                  <div>
                    <strong>{item.productTitle}</strong>
                    <p>
                      {item.variantTitle} · Qty {item.quantity}
                    </p>
                    {customisationSummary ? <p className="cart-item-customisation">{customisationSummary}</p> : null}
                    {item.trackingNumber ? (
                      <p className="tracking-line">
                        Shipped via {item.courier ?? "courier"}: <code>{item.trackingNumber}</code>
                        <span className="cart-note"> Tracking may take a short time to become active.</span>
                      </p>
                    ) : null}
                  </div>
                  <span>{formatProductPrice(item.lineTotalAmount, item.currencyCode)}</span>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      <div className="actions">
        <Link className="button primary" href="/products">
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
