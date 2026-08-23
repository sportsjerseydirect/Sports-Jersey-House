import {
  buildCustomerOrderConfirmationDraft,
  buildSupplierNewOrderDraft,
  buildSupplierTrackingOverdueDraft,
  listNotificationEventTypes
} from "@sjh/database";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Notifications | Admin",
  description: "Email and notification draft previews — outbound send disabled.",
  path: "/admin/notifications",
  noIndex: true
});

export default function AdminNotificationsPage() {
  const samples = [
    buildSupplierNewOrderDraft({
      poNumber: "PO-2026-0001",
      supplierName: "Default supplier",
      supplierEmail: "supplier@example.com",
      lineCount: 3,
      batchDate: "2026-08-23"
    }),
    buildSupplierTrackingOverdueDraft({
      poNumber: "PO-2026-0001",
      supplierEmail: "supplier@example.com",
      daysOverdue: 7
    }),
    buildCustomerOrderConfirmationDraft({
      email: "customer@example.com",
      orderNumber: "SJH-10001",
      totalAmount: "89.99",
      currencyCode: "USD",
      lines: [
        {
          title: "Manchester City Home Jersey",
          size: "XL",
          quantity: 1,
          customisation: "Name: CHADHA · Number: 10"
        }
      ]
    })
  ];

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Notification drafts</h1>
        <p>Event → audience → template preview. Outbound email remains disabled.</p>
      </div>

      <section aria-label="Event types">
        <h2>Supported event types</h2>
        <ul className="admin-list">
          {listNotificationEventTypes().map((event) => (
            <li key={event}>{event}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Sample drafts">
        <h2>Sample previews</h2>
        {samples.map((draft) => (
          <article className="status-panel" key={draft.eventType}>
            <h3>{draft.eventType}</h3>
            <p>
              Audience: {draft.audience} · To: {draft.to ?? "—"}
            </p>
            <p>
              <strong>{draft.subject}</strong>
            </p>
            <pre className="shipping-block">{draft.bodyText}</pre>
          </article>
        ))}
      </section>
    </main>
  );
}
