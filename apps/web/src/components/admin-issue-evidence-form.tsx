"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  caseNumber: string;
};

export function AdminIssueEvidenceForm({ caseNumber }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const kind = String(form.get("kind") ?? "note") as "note" | "url" | "image" | "file";

    try {
      const response = await fetch("/api/admin/issues/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseNumber,
          kind,
          ...(form.get("label") ? { label: String(form.get("label")) } : {}),
          ...(form.get("url") ? { url: String(form.get("url")) } : {}),
          ...(form.get("notes") ? { notes: String(form.get("notes")) } : {})
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Add evidence failed.");
        return;
      }
      event.currentTarget.reset();
      setMessage("Evidence added.");
      router.refresh();
    } catch {
      setMessage("Add evidence failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-inline-form" onSubmit={onSubmit}>
      <h2>Add evidence</h2>
      <label className="field">
        <span>Kind</span>
        <select defaultValue="url" name="kind">
          <option value="note">Note</option>
          <option value="url">URL</option>
          <option value="image">Image</option>
          <option value="file">File</option>
        </select>
      </label>
      <label className="field">
        <span>Label</span>
        <input name="label" type="text" />
      </label>
      <label className="field">
        <span>URL</span>
        <input name="url" placeholder="https://…" type="url" />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea name="notes" rows={2} />
      </label>
      <button className="button primary" disabled={busy} type="submit">
        {busy ? "Saving…" : "Add evidence"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
