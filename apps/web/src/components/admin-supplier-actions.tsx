"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminSupplierActions() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function bootstrap() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers", { method: "PUT" });
      const data = (await response.json()) as {
        error?: string;
        supplier?: { code: string };
        mappingsCreated?: number;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Bootstrap failed.");
        return;
      }
      setMessage(
        `Supplier ${data.supplier?.code} ready. Mappings created: ${data.mappingsCreated ?? 0}.`
      );
      router.refresh();
    } catch {
      setMessage("Bootstrap failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: String(form.get("code") ?? ""),
          name: String(form.get("name") ?? ""),
          ...(form.get("email") ? { email: String(form.get("email")) } : {}),
          ...(form.get("phone") ? { phone: String(form.get("phone")) } : {})
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Create failed.");
        return;
      }
      event.currentTarget.reset();
      setMessage("Supplier created.");
      router.refresh();
    } catch {
      setMessage("Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <button className="button secondary" disabled={busy} onClick={bootstrap} type="button">
        {busy ? "Working…" : "Bootstrap DEFAULT supplier + product mappings"}
      </button>

      <form className="admin-inline-form" onSubmit={createSupplier}>
        <h2>Create supplier</h2>
        <label className="field">
          <span>Code</span>
          <input name="code" required type="text" />
        </label>
        <label className="field">
          <span>Name</span>
          <input name="name" required type="text" />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" />
        </label>
        <label className="field">
          <span>Phone</span>
          <input name="phone" type="tel" />
        </label>
        <button className="button primary" disabled={busy} type="submit">
          Create
        </button>
      </form>

      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
