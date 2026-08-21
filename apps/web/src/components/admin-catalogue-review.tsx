"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProposalRow = {
  proposalNumber: string;
  title: string;
  recommendation: string;
  status: string;
  ipRiskLevel: string;
};

type QueueRow = {
  id: string;
  proposalNumber: string | null;
  title: string | null;
  recommendation: string | null;
  priority: number;
};

type Props = {
  proposals: ProposalRow[];
  reviewQueue: QueueRow[];
};

export function AdminCatalogueReview({ proposals, reviewQueue }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function review(proposalNumber: string, decision: "approved" | "rejected") {
    setBusy(proposalNumber);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/catalogue/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalNumber, decision })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Review failed.");
        return;
      }
      setMessage(`${proposalNumber} ${decision}.`);
      router.refresh();
    } catch {
      setMessage("Review failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-actions">
      <p>Approve or reject proposals only — never auto-publish or delete catalogue products.</p>
      {message ? <p role="status">{message}</p> : null}

      <h2>Open review queue</h2>
      {reviewQueue.length === 0 ? (
        <p>No open review items.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Proposal</th>
                <th>Title</th>
                <th>Recommendation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((row) => (
                <tr key={row.id}>
                  <td>{row.priority}</td>
                  <td>{row.proposalNumber ?? "—"}</td>
                  <td>{row.title ?? "—"}</td>
                  <td>{row.recommendation ?? "—"}</td>
                  <td>
                    {row.proposalNumber ? (
                      <div className="actions">
                        <button
                          className="button primary"
                          disabled={busy === row.proposalNumber}
                          onClick={() => review(row.proposalNumber!, "approved")}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy === row.proposalNumber}
                          onClick={() => review(row.proposalNumber!, "rejected")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Recent proposals</h2>
      {proposals.length === 0 ? (
        <p>No proposals yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Title</th>
                <th>Recommendation</th>
                <th>Status</th>
                <th>IP risk</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((row) => (
                <tr key={row.proposalNumber}>
                  <td>{row.proposalNumber}</td>
                  <td>{row.title}</td>
                  <td>{row.recommendation}</td>
                  <td>{row.status}</td>
                  <td>{row.ipRiskLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
