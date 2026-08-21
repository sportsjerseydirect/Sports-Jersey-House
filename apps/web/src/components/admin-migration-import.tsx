"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Health = {
  credentialsPresent: boolean;
  syncEnabled: boolean;
  sampleImportEnabled: boolean;
  status: string;
  message: string;
};

type Props = {
  health: Health;
};

export function AdminMigrationImport({ health }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sampleLimit, setSampleLimit] = useState(80);

  async function startRun(mode: "dry_run" | "sample", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setMessage(null);

    let sampleProducts:
      | Array<{
          shopifyProductId: string;
          title: string;
          handle: string;
          status: string;
        }>
      | undefined;

    if (event) {
      const form = new FormData(event.currentTarget);
      const shopifyProductId = String(form.get("shopifyProductId") ?? "").trim();
      const title = String(form.get("title") ?? "").trim();
      const handle = String(form.get("handle") ?? "").trim();
      if (shopifyProductId && title && handle) {
        sampleProducts = [
          {
            shopifyProductId,
            title,
            handle,
            status: String(form.get("status") ?? "draft")
          }
        ];
      }
    }

    try {
      const response = await fetch("/api/admin/shopify/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          mode,
          ...(sampleProducts ? { sampleProducts } : {})
        })
      });
      const data = (await response.json()) as {
        error?: string;
        note?: string;
        staged?: unknown[];
      };
      if (!response.ok) {
        setMessage(data.error ?? "Import run failed.");
        return;
      }
      setMessage(
        `${data.note ?? "Import run created."} Staged: ${data.staged?.length ?? 0}.`
      );
      if (event) {
        event.currentTarget.reset();
      }
      router.refresh();
    } catch {
      setMessage("Import run failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runControlledSample() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/shopify/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_sample",
          sampleLimit
        })
      });
      const data = (await response.json()) as {
        error?: string;
        report?: {
          ok?: boolean;
          message?: string;
          productsUpserted?: number;
          productsFetched?: number;
          runId?: string | null;
        };
      };
      if (!response.ok) {
        setMessage(data.error ?? "Controlled sample import failed.");
        return;
      }
      setMessage(
        data.report?.message ??
          `Sample import finished. Fetched ${data.report?.productsFetched ?? 0}, upserted ${data.report?.productsUpserted ?? 0}.`
      );
      router.refresh();
    } catch {
      setMessage("Controlled sample import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <article className="status-panel">
        <h2>Shopify connection</h2>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{health.status}</dd>
          </div>
          <div>
            <dt>Credentials</dt>
            <dd>{health.credentialsPresent ? "Present" : "Missing"}</dd>
          </div>
          <div>
            <dt>Sample import gate</dt>
            <dd>{health.sampleImportEnabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Full sync gate</dt>
            <dd>{health.syncEnabled ? "Enabled" : "Disabled (keep off)"}</dd>
          </div>
        </dl>
        <p>{health.message}</p>
      </article>

      <div className="actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => startRun("dry_run")}
          type="button"
        >
          {busy ? "Working…" : "Create dry-run import"}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => startRun("sample")}
          type="button"
        >
          Create sample staging run
        </button>
      </div>

      <section className="admin-inline-form">
        <h2>Controlled live sample import</h2>
        <p>
          Requires ENABLE_SHOPIFY_SAMPLE_IMPORT=true. Read-only fetch; products stay draft/review.
          Does not enable full sync.
        </p>
        <label className="field">
          <span>Sample limit (max 100)</span>
          <input
            max={100}
            min={1}
            onChange={(event) => setSampleLimit(Number.parseInt(event.target.value, 10) || 80)}
            type="number"
            value={sampleLimit}
          />
        </label>
        <button
          className="button primary"
          disabled={busy || !health.sampleImportEnabled}
          onClick={() => void runControlledSample()}
          type="button"
        >
          {busy ? "Importing…" : "Run controlled sample import"}
        </button>
      </section>

      <form className="admin-inline-form" onSubmit={(event) => startRun("sample", event)}>
        <h2>Stage sample product (no live Shopify)</h2>
        <p>When gates are off, provide a sample payload to exercise staging only.</p>
        <label className="field">
          <span>Shopify product ID</span>
          <input name="shopifyProductId" required type="text" />
        </label>
        <label className="field">
          <span>Title</span>
          <input name="title" required type="text" />
        </label>
        <label className="field">
          <span>Handle / slug</span>
          <input name="handle" required type="text" />
        </label>
        <label className="field">
          <span>Status</span>
          <input defaultValue="draft" name="status" type="text" />
        </label>
        <button className="button primary" disabled={busy} type="submit">
          Stage sample
        </button>
      </form>

      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
