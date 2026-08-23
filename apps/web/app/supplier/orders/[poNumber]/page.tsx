import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SUPPLIER_SESSION_COOKIE, verifySupplierSessionToken } from "@/lib/supplier-auth";
import { getSupplierPurchaseOrderDetail } from "@sjh/database";
import { SupplierOrderActions } from "@/components/supplier-order-actions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ poNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { poNumber } = await params;
  return { title: `${poNumber} | Supplier portal`, robots: { index: false, follow: false } };
}

export default async function SupplierOrderPage({ params }: Props) {
  const session = await verifySupplierSessionToken(
    (await cookies()).get(SUPPLIER_SESSION_COOKIE)?.value
  );
  if (!session) return null;

  const { poNumber } = await params;

  let detail;
  try {
    detail = await getSupplierPurchaseOrderDetail(session.supplierId, poNumber);
  } catch {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Purchase order</p>
        <h1>{detail.poNumber}</h1>
        <p>Status: {detail.status}</p>
      </div>

      <SupplierOrderActions
        acknowledged={Boolean(detail.acknowledgedAt)}
        lines={detail.lines.map((line) => ({
          id: line.id,
          productTitle: line.productTitle,
          sizeLabel: line.sizeLabel,
          orderNumber: line.orderNumber,
          trackingNumber: line.trackingNumber
        }))}
        poNumber={detail.poNumber}
      />

      <section className="supplier-order-lines" aria-label="Order lines">
        {detail.lines.map((line) => (
          <article className="supplier-line-card" key={line.id}>
            {line.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="supplier-line-image" height={120} src={line.imageUrl} width={120} />
            ) : null}
            <div>
              <h2>{line.productTitle}</h2>
              <dl className="supplier-line-spec">
                <div>
                  <dt>Order</dt>
                  <dd>{line.orderNumber}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{line.sizeLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{line.quantity}</dd>
                </div>
                <div>
                  <dt>Custom name</dt>
                  <dd>{line.customisation.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Number</dt>
                  <dd>{line.customisation.number ?? "—"}</dd>
                </div>
                {line.customisation.message ? (
                  <div>
                    <dt>Message</dt>
                    <dd>{line.customisation.message}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Status</dt>
                  <dd>{line.fulfilmentStatus}</dd>
                </div>
                {line.trackingNumber ? (
                  <div>
                    <dt>Tracking</dt>
                    <dd>
                      {line.courier ? `${line.courier}: ` : ""}
                      {line.trackingNumber}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {line.shippingAddress ? (
                <details>
                  <summary>Shipping information</summary>
                  <pre className="shipping-block">{JSON.stringify(line.shippingAddress, null, 2)}</pre>
                </details>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
