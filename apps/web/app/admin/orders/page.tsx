import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listOrders } from "@sjh/database";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Orders | Admin | Sports Jersey House",
  description: "Admin order list for Sports Jersey House.",
  path: "/admin/orders",
  noIndex: true
});

export default async function AdminOrdersPage() {
  const orders = await listOrders(100);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Orders</h1>
        <p>Read-only order list. Payment collection (Stripe) arrives in a later phase.</p>
      </div>

      <p>
        <Link href="/admin">← Admin home</Link>
      </p>

      {orders.length === 0 ? (
        <section className="empty-state">
          <h2>No orders yet</h2>
          <p>Placed storefront checkouts will appear here.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Email</th>
                <th>Status</th>
                <th>Total</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${encodeURIComponent(order.orderNumber)}` as Route}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.email}</td>
                  <td>{order.status.replaceAll("_", " ")}</td>
                  <td>{formatProductPrice(order.totalAmount, order.currencyCode)}</td>
                  <td>{order.placedAt ? new Date(order.placedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
