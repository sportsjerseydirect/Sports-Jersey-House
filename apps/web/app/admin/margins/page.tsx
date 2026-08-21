import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listRecentOrderMargins } from "@sjh/database";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Margins | Admin | Sports Jersey House",
  description: "Order and line-level margin report.",
  path: "/admin/margins",
  noIndex: true
});

export default async function AdminMarginsPage() {
  const orders = await listRecentOrderMargins(50);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Margins</h1>
        <p>Line-level P&amp;L from sell price, discounts, shipping revenue, fees, and costs.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      {orders.length === 0 ? (
        <section className="empty-state">
          <h2>No orders yet</h2>
          <p>Margins appear after checkout creates orders.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Net revenue</th>
                <th>Costs</th>
                <th>Gross profit</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderId}>
                  <td>
                    <Link href={`/admin/margins/${encodeURIComponent(order.orderNumber)}` as Route}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.status.replaceAll("_", " ")}</td>
                  <td>{formatProductPrice(order.totals.netRevenueAmount, order.currencyCode)}</td>
                  <td>{formatProductPrice(order.totals.totalCostAmount, order.currencyCode)}</td>
                  <td>{formatProductPrice(order.totals.grossProfitAmount, order.currencyCode)}</td>
                  <td>{order.totals.marginPercent === null ? "—" : `${order.totals.marginPercent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
