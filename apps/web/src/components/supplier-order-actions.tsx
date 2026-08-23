"use client";

import { useState } from "react";

type LineForTracking = {
  id: string;
  productTitle: string;
  sizeLabel: string | null;
  orderNumber: string;
  trackingNumber: string | null;
};

type Props = {
  poNumber: string;
  acknowledged: boolean;
  lines: LineForTracking[];
};

export function SupplierOrderActions({ poNumber, acknowledged, lines }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costAmount, setCostAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [costNotes, setCostNotes] = useState("");
  const [trackingByLine, setTrackingByLine] = useState<Record<string, { number: string; courier: string }>>(
    {}
  );

  async function post(path: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Request failed.");
      return;
    }
    setMessage("Saved.");
    window.location.reload();
  }

  return (
    <section className="supplier-actions" aria-label="Supplier actions">
      {!acknowledged ? (
        <button
          className="button primary"
          onClick={() => post(`/api/supplier/orders/${poNumber}/acknowledge`, {})}
          type="button"
        >
          Acknowledge order
        </button>
      ) : null}

      <p>
        <a className="text-button" href={`/api/supplier/orders/${poNumber}/packing-slip`} rel="noopener">
          Download packing slip
        </a>
      </p>

      <div className="supplier-action-form">
        <h3>Submit supplier cost</h3>
        <label className="field">
          <span>Product cost (your cost)</span>
          <input onChange={(e) => setCostAmount(e.target.value)} type="text" value={costAmount} />
        </label>
        <label className="field">
          <span>Shipping cost (optional)</span>
          <input onChange={(e) => setShippingCost(e.target.value)} type="text" value={shippingCost} />
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <input onChange={(e) => setCostNotes(e.target.value)} type="text" value={costNotes} />
        </label>
        <button
          className="button secondary"
          onClick={() =>
            post(`/api/supplier/orders/${poNumber}/cost`, {
              amount: costAmount,
              shippingCost: shippingCost || undefined,
              notes: costNotes || undefined
            })
          }
          type="button"
        >
          Submit cost
        </button>
      </div>

      {acknowledged ? (
        <div className="supplier-action-form">
          <h3>Add tracking per line</h3>
          {lines.map((line) => (
            <div className="supplier-line-tracking" key={line.id}>
              <p>
                <strong>{line.productTitle}</strong>
                {line.sizeLabel ? ` · ${line.sizeLabel}` : ""} — Order {line.orderNumber}
              </p>
              {line.trackingNumber ? (
                <p>Tracking: {line.trackingNumber}</p>
              ) : (
                <>
                  <label className="field">
                    <span>Tracking number</span>
                    <input
                      onChange={(e) =>
                        setTrackingByLine((prev) => ({
                          ...prev,
                          [line.id]: { number: e.target.value, courier: prev[line.id]?.courier ?? "" }
                        }))
                      }
                      type="text"
                      value={trackingByLine[line.id]?.number ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span>Carrier (optional)</span>
                    <input
                      onChange={(e) =>
                        setTrackingByLine((prev) => ({
                          ...prev,
                          [line.id]: { number: prev[line.id]?.number ?? "", courier: e.target.value }
                        }))
                      }
                      type="text"
                      value={trackingByLine[line.id]?.courier ?? ""}
                    />
                  </label>
                  <button
                    className="button secondary"
                    onClick={() =>
                      post(`/api/supplier/orders/${poNumber}/tracking`, {
                        orderItemId: line.id,
                        trackingNumber: trackingByLine[line.id]?.number ?? "",
                        courier: trackingByLine[line.id]?.courier || undefined
                      })
                    }
                    type="button"
                  >
                    Save tracking
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="admin-notice" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
