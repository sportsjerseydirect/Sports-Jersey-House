import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { listSupplierPurchaseOrders } from "@sjh/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supplier dashboard | Sports Jersey House",
  robots: { index: false, follow: false }
};

export default async function SupplierDashboardPage() {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );

  if (!session) {
    return null;
  }

  const orders = await listSupplierPurchaseOrders(session.supplierId);

  const buckets = {
    new: orders.filter((o) => !o.acknowledgedAt && ["sent", "ready"].includes(o.status)),
    awaitingTracking: orders.filter((o) => o.awaitingTracking && o.acknowledgedAt),
    inProduction: orders.filter((o) => o.status === "acknowledged" && o.awaitingTracking),
    completed: orders.filter((o) => o.status === "fulfilled")
  };

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Supplier portal</p>
        <h1>{session.supplierName}</h1>
        <p>Signed in as {session.email}</p>
      </div>

      <form action="/api/supplier/logout" method="post">
        <button className="text-button" type="submit">
          Sign out
        </button>
      </form>

      <section className="admin-grid" aria-label="Order queues">
        <article className="status-panel">
          <h2>New / awaiting acknowledgement</h2>
          <p>{buckets.new.length}</p>
        </article>
        <article className="status-panel">
          <h2>Awaiting tracking</h2>
          <p>{buckets.awaitingTracking.length}</p>
        </article>
        <article className="status-panel">
          <h2>In production</h2>
          <p>{buckets.inProduction.length}</p>
        </article>
      </section>

      <section aria-label="Purchase orders">
        <h2>Purchase orders</h2>
        {orders.length === 0 ? (
          <p>No orders assigned yet.</p>
        ) : (
          <ul className="admin-list">
            {orders.map((po) => (
              <li key={po.id}>
                <Link href={`/supplier/orders/${po.poNumber}` as Route}>
                  {po.poNumber} — {po.status} — {po.lineCount} line(s)
                  {po.awaitingTracking ? " · tracking needed" : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
