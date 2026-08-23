"use client";

import { useState } from "react";

type Props = {
  poNumber: string;
  acknowledged: boolean;
};

export function SupplierOrderActions({ poNumber, acknowledged }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingItemId, setTrackingItemId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [costAmount, setCostAmount] = useState("");

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

      <div className="supplier-action-form">
        <h3>Submit supplier cost</h3>
        <label className="field">
          <span>Amount (your cost)</span>
          <input onChange={(e) => setCostAmount(e.target.value)} type="text" value={costAmount} />
        </label>
        <button
          className="button secondary"
          onClick={() => post(`/api/supplier/orders/${poNumber}/cost`, { amount: costAmount })}
          type="button"
        >
          Submit cost
        </button>
      </div>

      <div className="supplier-action-form">
        <h3>Add tracking</h3>
        <label className="field">
          <span>Order line ID</span>
          <input onChange={(e) => setTrackingItemId(e.target.value)} type="text" value={trackingItemId} />
        </label>
        <label className="field">
          <span>Tracking number</span>
          <input onChange={(e) => setTrackingNumber(e.target.value)} type="text" value={trackingNumber} />
        </label>
        <label className="field">
          <span>Carrier (optional)</span>
          <input onChange={(e) => setCourier(e.target.value)} type="text" value={courier} />
        </label>
        <button
          className="button secondary"
          onClick={() =>
            post(`/api/supplier/orders/${poNumber}/tracking`, {
              orderItemId: trackingItemId,
              trackingNumber,
              courier
            })
          }
          type="button"
        >
          Save tracking
        </button>
      </div>

      {error ? (
        <p className="admin-notice" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
