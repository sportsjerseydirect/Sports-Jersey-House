"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Audit = {
  id: string;
  actionType: string;
  status: string;
  previewPayload: unknown;
  resultPayload: unknown;
  errorMessage: string | null;
  requiresConfirmation: boolean;
};

export function AdminAiOpsConsole() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentSummary, setIntentSummary] = useState<string | null>(null);
  const [pendingAudit, setPendingAudit] = useState<Audit | null>(null);

  async function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setPendingAudit(null);
    setIntentSummary(null);

    try {
      const response = await fetch("/api/admin/ai-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = (await response.json()) as {
        error?: string;
        intent?: { previewSummary: string };
        audit?: Audit;
      };
      if (!response.ok) {
        setError(data.error ?? "Preview failed.");
        return;
      }
      setIntentSummary(data.intent?.previewSummary ?? null);
      setPendingAudit(data.audit ?? null);
      router.refresh();
    } catch {
      setError("Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "confirm" | "reject") {
    if (!pendingAudit) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai-ops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: pendingAudit.id, decision })
      });
      const data = (await response.json()) as { error?: string; audit?: Audit };
      if (!response.ok) {
        setError(data.error ?? "Decision failed.");
        return;
      }
      setPendingAudit(data.audit ?? null);
      router.refresh();
    } catch {
      setError("Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <form className="admin-inline-form tracking-ingest-form" onSubmit={onPreview}>
        <h2>Ops assistant</h2>
        <p>
          Natural-language ops with audit trail. High-risk actions require confirm. Emails are draft-only. No blind
          destructive execution.
        </p>
        <label className="field">
          <span>Request</span>
          <textarea
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Examples: Create PO batch for 2026-08-20 · Show ageing orders older than 3 days · Margin for SJH-1001 · Chase PO-1001 · Open issue for wrong item on SJH-1001"
            required
            rows={6}
            value={prompt}
          />
        </label>
        <button className="button primary" disabled={busy || !prompt.trim()} type="submit">
          {busy ? "Working…" : "Preview / run safe query"}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
      {intentSummary ? <p role="status">{intentSummary}</p> : null}

      {pendingAudit ? (
        <article className="status-panel">
          <h2>
            {pendingAudit.actionType} · {pendingAudit.status.replaceAll("_", " ")}
          </h2>
          <pre className="email-draft">{JSON.stringify(pendingAudit.previewPayload, null, 2)}</pre>
          {pendingAudit.resultPayload ? (
            <pre className="email-draft">{JSON.stringify(pendingAudit.resultPayload, null, 2)}</pre>
          ) : null}
          {pendingAudit.errorMessage ? <p role="alert">{pendingAudit.errorMessage}</p> : null}
          {pendingAudit.requiresConfirmation && pendingAudit.status === "pending_confirmation" ? (
            <div className="actions">
              <button className="button primary" disabled={busy} onClick={() => decide("confirm")} type="button">
                Confirm &amp; execute
              </button>
              <button className="button secondary" disabled={busy} onClick={() => decide("reject")} type="button">
                Reject
              </button>
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
