"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, type FormEvent } from "react";

const REASONS = [
  { value: "wrong_item", label: "Wrong item" },
  { value: "manufacturing_defect", label: "Manufacturing defect" },
  { value: "damaged_in_transit", label: "Damaged in transit" },
  { value: "lost_shipment", label: "Lost shipment" },
  { value: "missing_item", label: "Missing item" },
  { value: "supplier_error", label: "Supplier error" },
  { value: "customer_issue", label: "Customer issue" },
  { value: "goodwill_replacement", label: "Goodwill replacement" }
] as const;

export function AdminIssueCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: String(form.get("orderNumber") ?? "").trim(),
          reason: String(form.get("reason") ?? ""),
          ...(form.get("customerNotes")
            ? { customerNotes: String(form.get("customerNotes")) }
            : {}),
          ...(form.get("internalNotes")
            ? { internalNotes: String(form.get("internalNotes")) }
            : {})
        })
      });
      const data = (await response.json()) as {
        error?: string;
        issue?: { caseNumber: string };
      };
      if (!response.ok) {
        setMessage(data.error ?? "Create failed.");
        return;
      }
      event.currentTarget.reset();
      setMessage(`Created ${data.issue?.caseNumber}.`);
      router.refresh();
      if (data.issue?.caseNumber) {
        router.push(`/admin/issues/${encodeURIComponent(data.issue.caseNumber)}` as Route);
      }
    } catch {
      setMessage("Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={onSubmit}>
      <h2>Open issue case</h2>
      <label className="field">
        <span>Order number</span>
        <input name="orderNumber" placeholder="SJH-1001" required type="text" />
      </label>
      <label className="field">
        <span>Reason</span>
        <select defaultValue="wrong_item" name="reason" required>
          {REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Customer notes</span>
        <textarea name="customerNotes" rows={3} />
      </label>
      <label className="field">
        <span>Internal notes</span>
        <textarea name="internalNotes" rows={3} />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Creating…" : "Create case"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
