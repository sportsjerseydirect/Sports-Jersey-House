import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { getSupplierDashboard, type SupplierPoBucket } from "@sjh/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supplier dashboard | Sports Jersey House",
  robots: { index: false, follow: false }
};

const BUCKET_LABELS: Record<SupplierPoBucket, string> = {
  new: "New",
  awaiting_acknowledgement: "Awaiting acknowledgement",
  in_production: "In production",
  awaiting_tracking: "Awaiting tracking",
  tracking_overdue: "Tracking overdue",
  dispatched: "Dispatched",
  delivered: "Delivered",
  delivery_overdue: "Delivery overdue",
  issues: "Issues",
  completed: "Completed"
};

export default async function SupplierDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );

  if (!session) {
    return null;
  }

  const { bucket: filterBucket } = await searchParams;
  const dashboard = await getSupplierDashboard(session.supplierId);
  const filtered = filterBucket
    ? dashboard.orders.filter((po) => po.bucket === filterBucket)
    : dashboard.orders;

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
        {(Object.keys(BUCKET_LABELS) as SupplierPoBucket[]).map((bucket) => (
          <article className="status-panel" key={bucket}>
            <h2>{BUCKET_LABELS[bucket]}</h2>
            <p>
              <Link href={`/supplier?bucket=${bucket}` as Route}>{dashboard.buckets[bucket]}</Link>
            </p>
          </article>
        ))}
      </section>

      <section aria-label="Purchase orders">
        <h2>
          Purchase orders
          {filterBucket ? ` — ${BUCKET_LABELS[filterBucket as SupplierPoBucket] ?? filterBucket}` : ""}
        </h2>
        {filterBucket ? (
          <p>
            <Link href="/supplier">Show all</Link>
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p>No orders in this queue.</p>
        ) : (
          <ul className="admin-list">
            {filtered.map((po) => (
              <li key={po.id}>
                <Link href={`/supplier/orders/${po.poNumber}` as Route}>
                  {po.poNumber} — {BUCKET_LABELS[po.bucket]} — {po.lineCount} line(s)
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
