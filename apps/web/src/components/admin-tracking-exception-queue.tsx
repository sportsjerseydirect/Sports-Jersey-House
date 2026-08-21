"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ExceptionRow = {
  id: string;
  rawLine: string;
  trackingNumber: string | null;
  orderNumber: string | null;
  reason: string;
  status: string;
  createdAt: string | Date;
};

type Props = {
  exceptions: ExceptionRow[];
};

export function AdminTrackingExceptionQueue({ exceptions }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function resolve(id: string, status: "resolved" | "ignored") {
    setBusyId(id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/tracking/exceptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Resolve failed.");
        return;
      }
      setMessage(`Exception marked ${status}.`);
      router.refresh();
    } catch {
      setMessage("Resolve failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (exceptions.length === 0) {
    return (
      <section className="empty-state">
        <h2>No open exceptions</h2>
        <p>Unmatched tracking paste lines will appear here.</p>
      </section>
    );
  }

  return (
    <div className="admin-actions">
      {message ? <p role="status">{message}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Order</th>
              <th>Tracking</th>
              <th>Reason</th>
              <th>Raw</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.orderNumber ?? "—"}</td>
                <td>{row.trackingNumber ?? "—"}</td>
                <td>{row.reason}</td>
                <td>
                  <code>{row.rawLine}</code>
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={busyId === row.id}
                      onClick={() => resolve(row.id, "resolved")}
                      type="button"
                    >
                      Resolve
                    </button>
                    <button
                      className="button secondary"
                      disabled={busyId === row.id}
                      onClick={() => resolve(row.id, "ignored")}
                      type="button"
                    >
                      Ignore
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
