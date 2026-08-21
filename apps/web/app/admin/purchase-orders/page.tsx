import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listPurchaseOrders } from "@sjh/database";
import { AdminPoBatchForm } from "@/components/admin-po-batch-form";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Purchase orders | Admin | Sports Jersey House",
  description: "Supplier purchase orders for Sports Jersey House.",
  path: "/admin/purchase-orders",
  noIndex: true
});

export default async function AdminPurchaseOrdersPage() {
  const purchaseOrders = await listPurchaseOrders(100);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Purchase orders</h1>
        <p>Batch supplier submissions with packing-slip preview. Email send is disabled.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminPoBatchForm />

      {purchaseOrders.length === 0 ? (
        <section className="empty-state">
          <h2>No purchase orders yet</h2>
          <p>Run a batch after orders exist and the DEFAULT supplier is bootstrapped.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Batch date</th>
                <th>Status</th>
                <th>Lines</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link href={`/admin/purchase-orders/${encodeURIComponent(po.poNumber)}` as Route}>
                      {po.poNumber}
                    </Link>
                  </td>
                  <td>
                    {po.supplier.code} — {po.supplier.name}
                  </td>
                  <td>{po.batchDate ?? "—"}</td>
                  <td>{po.status}</td>
                  <td>{po.lines.length}</td>
                  <td>{po.emailSentAt ? "Sent" : "Draft only"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
