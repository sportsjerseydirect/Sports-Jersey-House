import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPurchaseOrderByNumber } from "@sjh/database";
import { createMetadata } from "@/lib/seo";

type AdminPoDetailProps = {
  params: Promise<{ poNumber: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AdminPoDetailProps): Promise<Metadata> {
  const { poNumber } = await params;
  return createMetadata({
    title: `PO ${decodeURIComponent(poNumber)} | Admin`,
    description: "Purchase order detail and packing slip preview.",
    path: `/admin/purchase-orders/${poNumber}`,
    noIndex: true
  });
}

export default async function AdminPurchaseOrderDetailPage({ params }: AdminPoDetailProps) {
  const { poNumber: raw } = await params;
  const poNumber = decodeURIComponent(raw);
  const po = await getPurchaseOrderByNumber(poNumber);

  if (!po) {
    notFound();
  }

  const payload =
    po.packingSlipPayload && typeof po.packingSlipPayload === "object"
      ? (po.packingSlipPayload as { html?: string })
      : null;

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin · Purchase orders</p>
        <h1>{po.poNumber}</h1>
        <p>
          {po.supplier.code} — {po.supplier.name} · Batch {po.batchDate ?? "—"} · Status {po.status}
        </p>
      </div>

      <p>
        <Link href={"/admin/purchase-orders" as Route}>← All purchase orders</Link>
      </p>

      <section className="order-confirmation" aria-label="Purchase order detail">
        <article className="status-panel">
          <h2>Email draft (not sent)</h2>
          <dl>
            <div>
              <dt>To</dt>
              <dd>{po.emailPreview.to ?? "—"}</dd>
            </div>
            <div>
              <dt>Subject</dt>
              <dd>{po.emailPreview.subject}</dd>
            </div>
          </dl>
          <pre className="email-draft">{po.emailPreview.bodyText}</pre>
          <p className="cart-note">Outbound supplier email is disabled until explicitly approved.</p>
        </article>

        <article className="status-panel">
          <h2>Lines</h2>
          <ul className="order-lines">
            {po.lines.map((line) => (
              <li key={line.id}>
                <div>
                  <strong>
                    {line.orderNumber} · {line.productTitle}
                  </strong>
                  <p>
                    {line.variantTitle}
                    {line.sizeLabel ? ` / ${line.sizeLabel}` : ""} · Qty {line.quantity}
                    {line.supplierSku ? ` · SKU ${line.supplierSku}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="status-panel">
          <h2>Packing slip preview</h2>
          {payload?.html ? (
            <iframe className="packing-slip-frame" srcDoc={payload.html} title={`Packing slip ${po.poNumber}`} />
          ) : (
            <p>No packing slip payload.</p>
          )}
        </article>
      </section>
    </main>
  );
}
