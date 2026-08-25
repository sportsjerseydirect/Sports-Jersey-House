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

export default async function OrderConfirmationPage({
  params,
  searchParams
}: OrderPageProps & { searchParams: Promise<{ checkout?: string }> }) {
  const { orderNumber: raw } = await params;
  const { checkout } = await searchParams;
  const orderNumber = decodeURIComponent(raw);
  const order = await getOrderByNumber(orderNumber);

  if (!order) {
    notFound();
  }

  const statusLabel = order.status.replaceAll("_", " ");
  const paymentMessage =
    order.status === "paid"
      ? "Payment confirmed via Stripe. We will prepare your made-to-order jersey for production."
      : checkout === "cancelled"
        ? "Checkout was cancelled. This order remains awaiting payment and has not been sent to a supplier."
        : checkout === "success"
          ? "Thanks — if payment just completed, confirmation may take a moment while Stripe notifies us."
          : "This order is awaiting payment. It will only move to production after Stripe confirms payment.";

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">{order.status === "paid" ? "Order paid" : "Order received"}</p>
        <h1>{order.orderNumber}</h1>
        <p>
          Thanks{order.shippingAddress?.fullName ? `, ${order.shippingAddress.fullName}` : ""}. Status:{" "}
          <strong>{statusLabel}</strong>. {paymentMessage}
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
              const summaryLines =
                item.optionsSummary && item.optionsSummary.length > 0
                  ? item.optionsSummary
                  : [
                      ...(item.colourLabel ? [`Colour: ${item.colourLabel}`] : []),
                      ...(item.sizeLabel ? [`Size: ${item.sizeLabel}`] : [item.variantTitle]),
                      ...(formatCustomisationSummary(item.customisation)
                        ? [formatCustomisationSummary(item.customisation)!]
                        : [])
                    ];
              return (
                <li key={item.id}>
                  <div>
                    <strong>{item.productTitle}</strong>
                    <p>Qty {item.quantity}</p>
                    {summaryLines.map((line) => (
                      <p className="cart-item-customisation" key={line}>
                        {line}
                      </p>
                    ))}
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
