import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderMargins } from "@sjh/database";
import { AdminMarginCostEditor } from "@/components/admin-margin-cost-editor";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ orderNumber: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return createMetadata({
    title: `Margins ${decodeURIComponent(orderNumber)} | Admin`,
    description: "Order margin detail.",
    path: `/admin/margins/${orderNumber}`,
    noIndex: true
  });
}

export default async function AdminMarginDetailPage({ params }: Props) {
  const { orderNumber: raw } = await params;
  const orderNumber = decodeURIComponent(raw);
  const margin = await getOrderMargins(orderNumber);

  if (!margin) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin · Margins</p>
        <h1>{margin.orderNumber}</h1>
        <p>
          Net {formatProductPrice(margin.totals.netRevenueAmount, margin.currencyCode)} · Profit{" "}
          {formatProductPrice(margin.totals.grossProfitAmount, margin.currencyCode)} · Margin{" "}
          {margin.totals.marginPercent === null ? "—" : `${margin.totals.marginPercent}%`}
        </p>
      </div>

      <p>
        <Link href={"/admin/margins" as Route}>← All margins</Link>
        {" · "}
        <Link href={`/admin/orders/${encodeURIComponent(margin.orderNumber)}` as Route}>Order detail</Link>
      </p>

      <section className="order-confirmation" aria-label="Margin detail">
        <article className="status-panel">
          <h2>Order economics</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatProductPrice(margin.orderSubtotalAmount, margin.currencyCode)}</dd>
            </div>
            <div>
              <dt>Shipping revenue</dt>
              <dd>{formatProductPrice(margin.shippingRevenueAmount, margin.currencyCode)}</dd>
            </div>
            <div>
              <dt>Payment fees</dt>
              <dd>{formatProductPrice(margin.paymentFeeAmount, margin.currencyCode)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{formatProductPrice(margin.taxAmount, margin.currencyCode)}</dd>
            </div>
            <div>
              <dt>Total charged</dt>
              <dd>{formatProductPrice(margin.orderTotalAmount, margin.currencyCode)}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Line margins</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Net rev</th>
                  <th>Costs</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {margin.lines.map((line) => (
                  <tr key={line.orderItemId}>
                    <td>
                      {line.productTitle}
                      <br />
                      <small>
                        {line.variantTitle} · Qty {line.quantity}
                      </small>
                    </td>
                    <td>{formatProductPrice(line.netRevenueAmount, line.currencyCode)}</td>
                    <td>{formatProductPrice(line.totalCostAmount, line.currencyCode)}</td>
                    <td>{formatProductPrice(line.grossProfitAmount, line.currencyCode)}</td>
                    <td>{line.marginPercent === null ? "—" : `${line.marginPercent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="status-panel">
          <h2>Edit costs</h2>
          <AdminMarginCostEditor
            lines={margin.lines.map((line) => ({
              orderItemId: line.orderItemId,
              productTitle: line.productTitle,
              supplierCostAmount: line.supplierCostAmount,
              customisationCostAmount: line.customisationCostAmount,
              fulfilmentCostAmount: line.fulfilmentCostAmount,
              otherCostAmount: line.otherCostAmount
            }))}
            orderNumber={margin.orderNumber}
          />
        </article>
      </section>
    </main>
  );
}
