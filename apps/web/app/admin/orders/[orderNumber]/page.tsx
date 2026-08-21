import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCustomisationSummary } from "@sjh/shared";
import { getOrderByNumber } from "@sjh/database";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

type AdminOrderDetailProps = {
  params: Promise<{ orderNumber: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AdminOrderDetailProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return createMetadata({
    title: `Order ${decodeURIComponent(orderNumber)} | Admin`,
    description: "Admin order detail.",
    path: `/admin/orders/${orderNumber}`,
    noIndex: true
  });
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailProps) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw);
  const order = await getOrderByNumber(orderNumber);

  if (!order) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin · Orders</p>
        <h1>{order.orderNumber}</h1>
        <p>
          Status: {order.status.replaceAll("_", " ")} · Fulfilment:{" "}
          {order.fulfilmentStatus.replaceAll("_", " ")}
        </p>
      </div>

      <p>
        <Link href={"/admin/orders" as Route}>← All orders</Link>
      </p>

      <section className="order-confirmation" aria-label="Admin order detail">
        <article className="status-panel">
          <h2>Customer</h2>
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
              <dt>Placed</dt>
              <dd>{order.placedAt ? new Date(order.placedAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>
          {order.customerNotes ? <p>Notes: {order.customerNotes}</p> : null}
        </article>

        {order.shippingAddress ? (
          <article className="status-panel">
            <h2>Shipping destination</h2>
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
              {order.shippingAddress.city}, {order.shippingAddress.region}{" "}
              {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
            </p>
          </article>
        ) : null}

        <article className="status-panel">
          <h2>Line items</h2>
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
                  </div>
                  <span>{formatProductPrice(item.lineTotalAmount, item.currencyCode)}</span>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </main>
  );
}
