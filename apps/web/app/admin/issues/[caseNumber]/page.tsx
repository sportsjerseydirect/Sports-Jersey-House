import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssueCaseByNumber, listIssueEvidence } from "@sjh/database";
import { AdminIssueEvidenceForm } from "@/components/admin-issue-evidence-form";
import { AdminIssueUpdateForm } from "@/components/admin-issue-update-form";
import { formatProductPrice } from "@/lib/products";
import { createMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ caseNumber: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { caseNumber } = await params;
  return createMetadata({
    title: `Case ${decodeURIComponent(caseNumber)} | Admin`,
    description: "Issue case detail.",
    path: `/admin/issues/${caseNumber}`,
    noIndex: true
  });
}

export default async function AdminIssueDetailPage({ params }: Props) {
  const { caseNumber: raw } = await params;
  const caseNumber = decodeURIComponent(raw);
  const issue = await getIssueCaseByNumber(caseNumber);

  if (!issue) {
    notFound();
  }

  const evidence = await listIssueEvidence(caseNumber);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin · Issues</p>
        <h1>{issue.caseNumber}</h1>
        <p>
          {issue.reason.replaceAll("_", " ")} · {issue.status.replaceAll("_", " ")} · Order{" "}
          {issue.orderNumber}
        </p>
      </div>

      <p>
        <Link href={"/admin/issues" as Route}>← All cases</Link>
        {" · "}
        <Link href={`/admin/orders/${encodeURIComponent(issue.orderNumber)}` as Route}>
          Source order
        </Link>
        {issue.replacementOrderNumber ? (
          <>
            {" · "}
            <Link href={`/admin/orders/${encodeURIComponent(issue.replacementOrderNumber)}` as Route}>
              Replacement order
            </Link>
          </>
        ) : null}
      </p>

      <section className="order-confirmation" aria-label="Issue case detail">
        <article className="status-panel">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Reason</dt>
              <dd>{issue.reason.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{issue.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Supplier responsibility</dt>
              <dd>
                {issue.supplierResponsibility === null
                  ? "—"
                  : issue.supplierResponsibility
                    ? "Yes"
                    : "No"}
              </dd>
            </div>
            <div>
              <dt>Replacement cost</dt>
              <dd>
                {issue.replacementCostAmount
                  ? formatProductPrice(issue.replacementCostAmount, "USD")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd>{issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>
          {issue.customerNotes ? <p>Customer: {issue.customerNotes}</p> : null}
          {issue.internalNotes ? <p>Internal: {issue.internalNotes}</p> : null}
          {issue.decision ? <p>Decision: {issue.decision}</p> : null}
          {issue.resolution ? <p>Resolution: {issue.resolution}</p> : null}
        </article>

        <article className="status-panel">
          <AdminIssueUpdateForm
            caseNumber={issue.caseNumber}
            customerNotes={issue.customerNotes}
            decision={issue.decision}
            internalNotes={issue.internalNotes}
            replacementCostAmount={issue.replacementCostAmount}
            replacementOrderNumber={issue.replacementOrderNumber}
            resolution={issue.resolution}
            status={issue.status}
            supplierResponsibility={issue.supplierResponsibility}
          />
        </article>

        <article className="status-panel">
          <h2>Evidence</h2>
          {evidence.length === 0 ? (
            <p>No evidence yet.</p>
          ) : (
            <ul>
              {evidence.map((item) => (
                <li key={item.id}>
                  <strong>{item.kind}</strong>
                  {item.label ? ` — ${item.label}` : ""}
                  {item.url ? (
                    <>
                      {" · "}
                      <a href={item.url} rel="noreferrer" target="_blank">
                        {item.url}
                      </a>
                    </>
                  ) : null}
                  {item.notes ? <div>{item.notes}</div> : null}
                </li>
              ))}
            </ul>
          )}
          <AdminIssueEvidenceForm caseNumber={issue.caseNumber} />
        </article>
      </section>
    </main>
  );
}
