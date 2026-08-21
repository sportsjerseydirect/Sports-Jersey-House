"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type RuleRow = {
  id: string;
  name: string;
  pattern: string;
  patternType: string;
  courierCode: string;
  courierName: string;
  priority: number;
  isActive: boolean;
  notes: string | null;
};

type Props = {
  rules: RuleRow[];
};

export function AdminCourierRuleForm({ rules }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
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

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const isActiveRaw = String(form.get("isActive") ?? "");

    try {
      const response = await fetch("/api/admin/courier-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(form.get("id") ?? ""),
          name: String(form.get("name") ?? ""),
          pattern: String(form.get("pattern") ?? ""),
          patternType: String(form.get("patternType") ?? "prefix"),
          courierCode: String(form.get("courierCode") ?? ""),
          courierName: String(form.get("courierName") ?? ""),
          priority: Number(form.get("priority") ?? 100),
          ...(form.get("notes") ? { notes: String(form.get("notes")) } : { notes: null }),
          ...(isActiveRaw === "yes"
            ? { isActive: true }
            : isActiveRaw === "no"
              ? { isActive: false }
              : {})
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Update failed.");
        return;
      }
      setMessage("Courier rule updated.");
      router.refresh();
    } catch {
      setMessage("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const first = rules[0];

  return (
    <div className="admin-actions">
      <form className="admin-inline-form" onSubmit={onCreate}>
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
      </form>

      {first ? (
        <form className="admin-inline-form" onSubmit={onUpdate}>
          <h2>Edit / deactivate rule</h2>
          <label className="field">
            <span>Rule</span>
            <select defaultValue={first.id} name="id" required>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  [{rule.priority}] {rule.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input defaultValue={first.name} name="name" required type="text" />
          </label>
          <label className="field">
            <span>Pattern type</span>
            <select defaultValue={first.patternType} name="patternType">
              <option value="prefix">Prefix</option>
              <option value="contains">Contains</option>
              <option value="regex">Regex</option>
            </select>
          </label>
          <label className="field">
            <span>Pattern</span>
            <input defaultValue={first.pattern} name="pattern" required type="text" />
          </label>
          <label className="field">
            <span>Courier code</span>
            <input defaultValue={first.courierCode} name="courierCode" required type="text" />
          </label>
          <label className="field">
            <span>Courier name</span>
            <input defaultValue={first.courierName} name="courierName" required type="text" />
          </label>
          <label className="field">
            <span>Priority</span>
            <input defaultValue={first.priority} min={1} name="priority" type="number" />
          </label>
          <label className="field">
            <span>Notes</span>
            <input defaultValue={first.notes ?? ""} name="notes" type="text" />
          </label>
          <label className="field">
            <span>Active</span>
            <select defaultValue={first.isActive ? "yes" : "no"} name="isActive">
              <option value="yes">Yes</option>
              <option value="no">No (deactivate)</option>
            </select>
          </label>
          <button className="button primary" disabled={busy} type="submit">
            Save rule
          </button>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
