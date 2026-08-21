"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  orderNumber: string;
  lines: Array<{
    orderItemId: string;
    productTitle: string;
    supplierCostAmount: string;
    customisationCostAmount: string;
    fulfilmentCostAmount: string;
    otherCostAmount: string;
  }>;
};

export function AdminMarginCostEditor({ orderNumber, lines }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function applyMapped() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/margins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber })
      });
      const data = (await response.json()) as { error?: string; updated?: number };
      if (!response.ok) {
        setMessage(data.error ?? "Apply failed.");
        return;
      }
      setMessage(`Applied mapped supplier costs to ${data.updated ?? 0} line(s).`);
      router.refresh();
    } catch {
      setMessage("Apply failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(event: FormEvent<HTMLFormElement>, orderItemId: string) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/margins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId,
          supplierCostAmount: String(form.get("supplierCostAmount") ?? "0"),
          customisationCostAmount: String(form.get("customisationCostAmount") ?? "0"),
          fulfilmentCostAmount: String(form.get("fulfilmentCostAmount") ?? "0"),
          otherCostAmount: String(form.get("otherCostAmount") ?? "0")
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Save failed.");
        return;
      }
      setMessage("Costs saved.");
      router.refresh();
    } catch {
      setMessage("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <button className="button secondary" disabled={busy} onClick={applyMapped} type="button">
        Apply mapped supplier unit costs
      </button>
      {message ? <p role="status">{message}</p> : null}

      {lines.map((line) => (
        <form
          className="admin-inline-form"
          key={line.orderItemId}
          onSubmit={(event) => saveLine(event, line.orderItemId)}
        >
          <h2>{line.productTitle}</h2>
          <label className="field">
            <span>Supplier cost</span>
            <input defaultValue={line.supplierCostAmount} name="supplierCostAmount" required step="0.01" type="number" />
          </label>
          <label className="field">
            <span>Customisation cost</span>
            <input
              defaultValue={line.customisationCostAmount}
              name="customisationCostAmount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Fulfilment cost</span>
            <input
              defaultValue={line.fulfilmentCostAmount}
              name="fulfilmentCostAmount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Other cost</span>
            <input defaultValue={line.otherCostAmount} name="otherCostAmount" required step="0.01" type="number" />
          </label>
          <button className="button primary" disabled={busy} type="submit">
            Save costs
          </button>
        </form>
      ))}
    </div>
  );
}
