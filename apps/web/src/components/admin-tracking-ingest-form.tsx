"use client";

import { useState, type FormEvent } from "react";

type IngestResult = {
  assigned: number;
  exceptions: number;
  skipped: number;
  results: Array<{
    raw: string;
    status: string;
    orderNumber?: string;
    trackingNumber?: string;
    message: string;
    courier?: { courierName: string; ruleName: string | null } | null;
  }>;
};

export function AdminTrackingIngestForm() {
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/tracking/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paste })
      });
      const data = (await response.json()) as IngestResult & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Ingest failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Ingest failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form tracking-ingest-form" onSubmit={onSubmit}>
      <h2>Paste tracking</h2>
      <p>
        One line per shipment. Formats: <code>ORDER TRACKING</code>, <code>ORDER|TRACKING</code>. Lines without an
        order number go to the exception list. Customer emails are not sent.
      </p>
      <label className="field">
        <span>Paste</span>
        <textarea
          onChange={(event) => setPaste(event.target.value)}
          placeholder={"SJH-1001 1Z999AA10123456784\nSJH-1002|AB123456789GB"}
          required
          rows={10}
          value={paste}
        />
      </label>
      <button className="button primary" disabled={busy || !paste.trim()} type="submit">
        {busy ? "Processing…" : "Ingest tracking"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <div className="tracking-ingest-result">
          <p>
            Assigned {result.assigned} · Exceptions {result.exceptions} · Skipped {result.skipped}
          </p>
          <ul>
            {result.results.map((row, index) => (
              <li key={`${row.raw}-${index}`}>
                <strong>{row.status}</strong>
                {row.orderNumber ? ` · ${row.orderNumber}` : ""}
                {row.trackingNumber ? ` · ${row.trackingNumber}` : ""}
                {row.courier?.courierName ? ` · ${row.courier.courierName}` : ""} — {row.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
