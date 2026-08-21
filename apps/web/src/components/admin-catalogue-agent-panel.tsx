"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CategoryRow = {
  category: string;
  mode: "learning" | "autonomous";
  consecutiveApprovals: number;
  approvalThreshold: number;
  alwaysRequireApproval: boolean;
  label: string;
  progressLabel: string;
};

type StatusView = {
  autonomousEnabledGlobally: boolean;
  modeLabel: "LEARNING" | "AUTONOMOUS" | "PAUSED";
  categories: CategoryRow[];
};

type ChangeRow = {
  id: string;
  category: string;
  productId: string | null;
  fieldName: string;
  reason: string;
  confidence: string | null;
  decision: string;
  previousValue: unknown;
  newValue: unknown;
};

type Props = {
  initialStatus: StatusView;
  pending: ChangeRow[];
  recent: ChangeRow[];
};

export function AdminCatalogueAgentPanel({ initialStatus, pending, recent }: Props) {
  const router = useRouter();
  const [pendingUi, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/catalogue/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as {
      error?: string;
      status?: StatusView;
      result?: { changesProposed: number; changesAutoApplied: number; newListingProposals: number };
      decided?: { categoryMode: CategoryRow };
    };
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    if (data.status) setStatus(data.status);
    if (data.result) {
      setMessage(
        `Agent run: ${data.result.changesProposed} proposed, ${data.result.changesAutoApplied} auto-applied, ${data.result.newListingProposals} new-listing suggestions.`
      );
    } else if (data.decided) {
      setMessage(
        `${data.decided.categoryMode.label}: ${data.decided.categoryMode.progressLabel}`
      );
    } else {
      setMessage("Updated.");
    }
    startTransition(() => router.refresh());
  }

  return (
    <section className="admin-panel" aria-label="AI Catalogue Agent">
      <h2>AI Catalogue Agent</h2>
      <p>
        Mode: <strong>{status.modeLabel}</strong>
        {status.autonomousEnabledGlobally ? "" : " (global autonomous disabled)"}
      </p>
      <p>
        Titles are never rewritten. Descriptions change only when needed. Taxonomy keeps league terms
        (e.g. NFL) while normalizing sport (Football).
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          disabled={pendingUi}
          onClick={() => void post({ action: "calibrate_and_apply" })}
          type="button"
        >
          Calibrate + apply high-confidence
        </button>
        <button
          disabled={pendingUi}
          onClick={() => void post({ action: "run_agent", limit: 80 })}
          type="button"
        >
          Run against imported sample
        </button>
        <button
          disabled={pendingUi}
          onClick={() =>
            void post({
              action: "set_global_autonomous",
              enabled: !status.autonomousEnabledGlobally
            })
          }
          type="button"
        >
          {status.autonomousEnabledGlobally ? "Disable autonomous globally" : "Enable autonomous globally"}
        </button>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <h3>Categories</h3>
      <ul>
        {status.categories.map((category) => (
          <li key={category.category}>
            <strong>{category.label}</strong> — {category.progressLabel}
            {category.alwaysRequireApproval ? " (always human for apply)" : ""}
          </li>
        ))}
      </ul>

      <h3>Pending changes</h3>
      {pending.length === 0 ? (
        <p>No pending AI changes.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Field</th>
                <th>Reason</th>
                <th>Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((change) => (
                <tr key={change.id}>
                  <td>{change.category}</td>
                  <td>{change.fieldName}</td>
                  <td>{change.reason}</td>
                  <td>{change.confidence ?? "—"}</td>
                  <td>
                    <button
                      disabled={pendingUi}
                      onClick={() =>
                        void post({
                          action: "decide_change",
                          changeId: change.id,
                          decision: "approved"
                        })
                      }
                      type="button"
                    >
                      Approve
                    </button>{" "}
                    <button
                      disabled={pendingUi}
                      onClick={() =>
                        void post({
                          action: "decide_change",
                          changeId: change.id,
                          decision: "rejected"
                        })
                      }
                      type="button"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Recent audit log</h3>
      <ul>
        {recent.slice(0, 12).map((change) => (
          <li key={change.id}>
            [{change.decision}] {change.category}/{change.fieldName} — {change.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
