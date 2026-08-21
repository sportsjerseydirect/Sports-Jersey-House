"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const JOB_TYPES = [
  { type: "daily_po_batch", label: "Daily PO batch" },
  { type: "margin_cost_refresh", label: "Margin cost refresh" },
  { type: "ops_exception_detection", label: "Exception detection" },
  { type: "tracking_ingest_check", label: "Tracking ingest check" },
  { type: "supplier_tracking_request", label: "Supplier tracking request (draft only)" }
] as const;

export function AdminJobsRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runJob(jobType: string) {
    setBusy(jobType);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType, dryRun: true })
      });
      const data = (await response.json()) as { error?: string; result?: unknown; run?: unknown };
      if (!response.ok) {
        setMessage(data.error ?? "Job failed.");
        return;
      }
      setMessage(`Dry-run ${jobType} completed.`);
      router.refresh();
    } catch {
      setMessage("Job failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-actions">
      <h2>Run jobs (dry-run)</h2>
      <p>
        Default dry-run. External email send remains disabled. Supplier tracking request always drafts only.
      </p>
      <div className="actions">
        {JOB_TYPES.map((job) => (
          <button
            className="button secondary"
            disabled={busy !== null}
            key={job.type}
            onClick={() => runJob(job.type)}
            type="button"
          >
            {busy === job.type ? "Running…" : job.label}
          </button>
        ))}
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
