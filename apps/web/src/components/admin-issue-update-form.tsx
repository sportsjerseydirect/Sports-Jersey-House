"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const STATUSES = [
  "open",
  "investigating",
  "awaiting_customer",
  "awaiting_supplier",
  "approved",
  "rejected",
  "resolved",
  "closed"
] as const;

type Props = {
  caseNumber: string;
  status: string;
  decision: string | null;
  resolution: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  supplierResponsibility: boolean | null;
  replacementCostAmount: string | null;
  replacementOrderNumber: string | null;
};

export function AdminIssueUpdateForm(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const supplierRaw = String(form.get("supplierResponsibility") ?? "");

    try {
      const response = await fetch("/api/admin/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber: props.caseNumber,
          status: String(form.get("status") ?? props.status),
          decision: String(form.get("decision") ?? ""),
          resolution: String(form.get("resolution") ?? ""),
          internalNotes: String(form.get("internalNotes") ?? ""),
          customerNotes: String(form.get("customerNotes") ?? ""),
          ...(supplierRaw === "yes"
            ? { supplierResponsibility: true }
            : supplierRaw === "no"
              ? { supplierResponsibility: false }
              : {}),
          ...(form.get("replacementCostAmount")
            ? { replacementCostAmount: String(form.get("replacementCostAmount")) }
            : {}),
          ...(form.get("replacementOrderNumber")
            ? { replacementOrderNumber: String(form.get("replacementOrderNumber")).trim() }
            : {})
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Update failed.");
        return;
      }
      setMessage("Case updated.");
      router.refresh();
    } catch {
      setMessage("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={onSubmit}>
      <h2>Update case</h2>
      <label className="field">
        <span>Status</span>
        <select defaultValue={props.status} name="status">
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Decision</span>
        <textarea defaultValue={props.decision ?? ""} name="decision" rows={2} />
      </label>
      <label className="field">
        <span>Resolution</span>
        <textarea defaultValue={props.resolution ?? ""} name="resolution" rows={2} />
      </label>
      <label className="field">
        <span>Internal notes</span>
        <textarea defaultValue={props.internalNotes ?? ""} name="internalNotes" rows={2} />
      </label>
      <label className="field">
        <span>Customer notes</span>
        <textarea defaultValue={props.customerNotes ?? ""} name="customerNotes" rows={2} />
      </label>
      <label className="field">
        <span>Supplier responsibility</span>
        <select
          defaultValue={
            props.supplierResponsibility === true
              ? "yes"
              : props.supplierResponsibility === false
                ? "no"
                : ""
          }
          name="supplierResponsibility"
        >
          <option value="">Unspecified</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label className="field">
        <span>Replacement order number</span>
        <input
          defaultValue={props.replacementOrderNumber ?? ""}
          name="replacementOrderNumber"
          placeholder="SJH-…"
          type="text"
        />
      </label>
      <label className="field">
        <span>Replacement cost</span>
        <input
          defaultValue={props.replacementCostAmount ?? ""}
          name="replacementCostAmount"
          step="0.01"
          type="number"
        />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Saving…" : "Save case"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
