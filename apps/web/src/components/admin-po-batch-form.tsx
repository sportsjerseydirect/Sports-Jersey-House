"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminPoBatchForm() {
  const router = useRouter();
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/purchase-orders/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchDate })
      });
      const data = (await response.json()) as {
        error?: string;
        createdCount?: number;
        eligibleLineCount?: number;
        skippedUnmapped?: number;
        purchaseOrders?: Array<{ poNumber: string; supplierCode: string; lineCount: number }>;
      };

      if (!response.ok) {
        setMessage(data.error ?? "Batch failed.");
        return;
      }

      const summary =
        data.purchaseOrders?.map((po) => `${po.poNumber} (${po.supplierCode}, ${po.lineCount} lines)`).join("; ") ||
        "none";
      setMessage(
        `Created ${data.createdCount ?? 0} PO(s) from ${data.eligibleLineCount ?? 0} eligible lines (skipped unmapped: ${data.skippedUnmapped ?? 0}). ${summary}`
      );
      router.refresh();
    } catch {
      setMessage("Batch failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={runBatch}>
      <h2>Run PO batch</h2>
      <p>
        Creates one PO per supplier for unfulfilled <code>pending_payment</code> / <code>paid</code> lines without a
        PO. Does not send supplier email.
      </p>
      <label className="field">
        <span>Batch date</span>
        <input onChange={(event) => setBatchDate(event.target.value)} required type="date" value={batchDate} />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Creating…" : "Create purchase orders"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
