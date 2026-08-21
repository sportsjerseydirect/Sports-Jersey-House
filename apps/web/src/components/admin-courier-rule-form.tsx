"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminCourierRuleForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/courier-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          pattern: String(form.get("pattern") ?? ""),
          patternType: String(form.get("patternType") ?? "prefix"),
          courierCode: String(form.get("courierCode") ?? ""),
          courierName: String(form.get("courierName") ?? ""),
          ...(form.get("priority") ? { priority: Number(form.get("priority")) } : {}),
          ...(form.get("notes") ? { notes: String(form.get("notes")) } : {})
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Create failed.");
        return;
      }
      event.currentTarget.reset();
      setMessage("Courier rule created.");
      router.refresh();
    } catch {
      setMessage("Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={onSubmit}>
      <h2>Add courier rule</h2>
      <p>Rules are configurable — no permanent courier mappings are hard-coded.</p>
      <label className="field">
        <span>Name</span>
        <input name="name" required type="text" />
      </label>
      <label className="field">
        <span>Pattern type</span>
        <select defaultValue="prefix" name="patternType">
          <option value="prefix">Prefix</option>
          <option value="contains">Contains</option>
          <option value="regex">Regex</option>
        </select>
      </label>
      <label className="field">
        <span>Pattern</span>
        <input name="pattern" placeholder="e.g. tracking prefix or regex" required type="text" />
      </label>
      <label className="field">
        <span>Courier code</span>
        <input name="courierCode" required type="text" />
      </label>
      <label className="field">
        <span>Courier name</span>
        <input name="courierName" required type="text" />
      </label>
      <label className="field">
        <span>Priority (lower runs first)</span>
        <input defaultValue={100} min={1} name="priority" type="number" />
      </label>
      <label className="field">
        <span>Notes</span>
        <input name="notes" type="text" />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Saving…" : "Create rule"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
