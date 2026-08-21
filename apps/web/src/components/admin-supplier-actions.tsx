"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  packingSlipFormat: string;
  isActive: boolean;
};

type Props = {
  suppliers: SupplierRow[];
};

export function AdminSupplierActions({ suppliers }: Props) {
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

  async function updateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const isActiveRaw = String(form.get("isActive") ?? "");
    try {
      const response = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(form.get("id") ?? ""),
          name: String(form.get("name") ?? ""),
          ...(form.get("email") ? { email: String(form.get("email")) } : { email: null }),
          ...(form.get("phone") ? { phone: String(form.get("phone")) } : { phone: null }),
          packingSlipFormat: String(form.get("packingSlipFormat") ?? "standard"),
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
      setMessage("Supplier updated.");
      router.refresh();
    } catch {
      setMessage("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upsertMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/suppliers/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: String(form.get("productId") ?? "").trim(),
          supplierId: String(form.get("supplierId") ?? "").trim(),
          ...(form.get("supplierSku")
            ? { supplierSku: String(form.get("supplierSku")) }
            : {}),
          ...(form.get("unitCostAmount")
            ? { unitCostAmount: String(form.get("unitCostAmount")) }
            : {}),
          isPrimary: form.get("isPrimary") === "on"
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Mapping failed.");
        return;
      }
      event.currentTarget.reset();
      setMessage("Product–supplier mapping saved.");
      router.refresh();
    } catch {
      setMessage("Mapping failed.");
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

      {suppliers.length > 0 ? (
        <form className="admin-inline-form" onSubmit={updateSupplier}>
          <h2>Edit / deactivate supplier</h2>
          <label className="field">
            <span>Supplier</span>
            <select defaultValue={suppliers[0]?.id} name="id" required>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} — {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input defaultValue={suppliers[0]?.name ?? ""} name="name" required type="text" />
          </label>
          <label className="field">
            <span>Email</span>
            <input defaultValue={suppliers[0]?.email ?? ""} name="email" type="email" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input defaultValue={suppliers[0]?.phone ?? ""} name="phone" type="tel" />
          </label>
          <label className="field">
            <span>Packing slip format</span>
            <input
              defaultValue={suppliers[0]?.packingSlipFormat ?? "standard"}
              name="packingSlipFormat"
              type="text"
            />
          </label>
          <label className="field">
            <span>Active</span>
            <select defaultValue={suppliers[0]?.isActive ? "yes" : "no"} name="isActive">
              <option value="yes">Yes</option>
              <option value="no">No (deactivate)</option>
            </select>
          </label>
          <button className="button primary" disabled={busy} type="submit">
            Save supplier
          </button>
        </form>
      ) : null}

      {suppliers.length > 0 ? (
        <form className="admin-inline-form" onSubmit={upsertMapping}>
          <h2>Product–supplier mapping</h2>
          <label className="field">
            <span>Product ID</span>
            <input name="productId" placeholder="UUID" required type="text" />
          </label>
          <label className="field">
            <span>Supplier</span>
            <select name="supplierId" required>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Supplier SKU</span>
            <input name="supplierSku" type="text" />
          </label>
          <label className="field">
            <span>Unit cost</span>
            <input name="unitCostAmount" step="0.01" type="number" />
          </label>
          <label className="field">
            <span>
              <input name="isPrimary" type="checkbox" /> Primary mapping
            </span>
          </label>
          <button className="button primary" disabled={busy} type="submit">
            Save mapping
          </button>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
