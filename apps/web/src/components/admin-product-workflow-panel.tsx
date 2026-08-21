"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductStatus } from "@sjh/shared";

type ReadinessCheckView = {
  id: string;
  label: string;
  ok: boolean;
  severity: "info" | "warning" | "blocker";
  detail: string;
};

type ReadinessView = {
  overall: "READY" | "NEEDS_REVIEW" | "BLOCKED";
  checks: ReadinessCheckView[];
  canPublish: boolean;
};

type AdminProductWorkflowPanelProps = {
  productId: string;
  slug: string;
  status: ProductStatus;
  readiness: ReadinessView;
};

const ACTIONS: Array<{
  action: string;
  label: string;
  from: ProductStatus[];
  confirmWarnings?: boolean;
}> = [
  { action: "send_to_review", label: "Send to Review", from: ["draft", "approved"] },
  { action: "approve", label: "Approve", from: ["review"] },
  {
    action: "publish",
    label: "Publish",
    from: ["approved"],
    confirmWarnings: true
  },
  {
    action: "reject_to_draft",
    label: "Reject / Return to Draft",
    from: ["review", "approved", "published"]
  },
  {
    action: "archive",
    label: "Archive",
    from: ["draft", "review", "approved", "published"]
  }
];

export function AdminProductWorkflowPanel({
  productId,
  slug,
  status,
  readiness
}: AdminProductWorkflowPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(action: string, forcePublishDespiteWarnings = false) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/catalogue/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, action, forcePublishDespiteWarnings })
    });
    const data = (await response.json()) as { error?: string; status?: string };
    if (!response.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    setMessage(`Status is now ${data.status}.`);
    startTransition(() => router.refresh());
  }

  return (
    <section className="admin-panel" aria-label="Product approval workflow">
      <h2>Approval workflow</h2>
      <p>
        Current status: <strong>{status}</strong> · Readiness: <strong>{readiness.overall}</strong>
      </p>
      <p>
        Preview: <code>/admin/preview/products/{slug}</code>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        {ACTIONS.filter((entry) => entry.from.includes(status)).map((entry) => (
          <button
            disabled={pending}
            key={entry.action}
            onClick={() => {
              if (entry.action === "publish" && readiness.overall === "BLOCKED") {
                setError("Publish blocked by readiness checklist.");
                return;
              }
              const force =
                entry.confirmWarnings === true && readiness.overall === "NEEDS_REVIEW"
                  ? window.confirm(
                      "Readiness is NEEDS_REVIEW. Publish anyway with warnings?"
                    )
                  : false;
              if (
                entry.confirmWarnings === true &&
                readiness.overall === "NEEDS_REVIEW" &&
                !force
              ) {
                return;
              }
              void runAction(entry.action, force);
            }}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <h3>Publish readiness checklist</h3>
      <ul>
        {readiness.checks.map((check) => (
          <li key={check.id}>
            <strong>{check.ok ? "OK" : check.severity.toUpperCase()}</strong> — {check.label}:{" "}
            {check.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
