"use client";

import type { Route } from "next";
import Link from "next/link";
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

const EXAMPLE_PROMPTS = [
  "What needs my attention today?",
  "Show me all orders waiting for tracking.",
  "Which suppliers have overdue tracking?",
  "Show me low-margin orders.",
  "Show me chargeback risk.",
  "Create today's supplier packing slips.",
  "Margin for SJH-10002"
];

export function AdminCommandAiBox() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentSummary, setIntentSummary] = useState<string | null>(null);
  const [pendingAudit, setPendingAudit] = useState<Audit | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
        setError(data.error ?? "Request failed.");
        return;
      }
      setIntentSummary(data.intent?.previewSummary ?? null);
      setPendingAudit(data.audit ?? null);
      router.refresh();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "confirm" | "reject") {
    if (!pendingAudit) return;
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
    <section className="admin-command-ai" aria-label="AI command centre">
      <div className="admin-command-ai__head">
        <div>
          <p className="eyebrow">AI command centre</p>
          <h2>What would you like SJH to do?</h2>
          <p>
            Operational requests with audit trail. High-risk actions require your confirmation. No
            blind execution.
          </p>
        </div>
        <Link className="admin-command-ai__link" href={"/admin/ai-ops" as Route}>
          Full AI ops console →
        </Link>
      </div>

      <form className="admin-command-ai__form" onSubmit={onSubmit}>
        <label className="field">
          <span className="sr-only">Operational request</span>
          <textarea
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask in plain language — e.g. show ageing orders, chase a PO, check margins, open an issue…"
            required
            rows={4}
            value={prompt}
          />
        </label>
        <div className="admin-command-ai__actions">
          <button className="button primary" disabled={busy || !prompt.trim()} type="submit">
            {busy ? "Working…" : "Run request"}
          </button>
          <div className="admin-command-ai__examples" aria-label="Example prompts">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                className="admin-command-ai__chip"
                disabled={busy}
                key={example}
                onClick={() => setPrompt(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </form>

      {error ? (
        <p className="admin-command-ai__message admin-command-ai__message--error" role="alert">
          {error}
        </p>
      ) : null}
      {intentSummary ? (
        <p className="admin-command-ai__message" role="status">
          {intentSummary}
        </p>
      ) : null}

      {pendingAudit ? (
        <article className="admin-command-ai__result">
          <h3>
            {pendingAudit.actionType.replaceAll("_", " ")} ·{" "}
            {pendingAudit.status.replaceAll("_", " ")}
          </h3>
          {pendingAudit.resultPayload ? (
            <pre>{JSON.stringify(pendingAudit.resultPayload, null, 2)}</pre>
          ) : pendingAudit.previewPayload ? (
            <pre>{JSON.stringify(pendingAudit.previewPayload, null, 2)}</pre>
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
    </section>
  );
}
