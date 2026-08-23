import type { Route } from "next";
import Link from "next/link";

export type AdminCommandCardProps = {
  href: Route;
  title: string;
  description?: string;
  count?: number | null;
  metric?: string | null;
  countLabel?: string;
  unavailable?: boolean;
  alert?: boolean;
};

function formatCount(count: number): string {
  return count.toLocaleString("en-GB");
}

export function AdminCommandCard({
  href,
  title,
  description,
  count,
  metric,
  countLabel,
  unavailable = false,
  alert = false
}: AdminCommandCardProps) {
  const showCount = !unavailable && count !== null && count !== undefined;
  const showMetric = !unavailable && !showCount && Boolean(metric);
  const showUnavailable = unavailable;

  return (
    <Link
      className={[
        "admin-command-card",
        alert && showCount && count > 0 ? "admin-command-card--alert" : "",
        showUnavailable ? "admin-command-card--muted" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      href={href}
    >
      <div className="admin-command-card__head">
        <h3>{title}</h3>
        {showCount ? (
          <span className="admin-command-card__count" aria-label={countLabel ?? title}>
            {formatCount(count)}
          </span>
        ) : showMetric ? (
          <span className="admin-command-card__metric" aria-label={countLabel ?? title}>
            {metric}
          </span>
        ) : showUnavailable ? (
          <span className="admin-command-card__badge">Not available yet</span>
        ) : null}
      </div>
      {description ? <p>{description}</p> : null}
    </Link>
  );
}

export function AdminCommandSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-command-section" aria-label={title}>
      <div className="admin-command-section__head">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="admin-command-grid">{children}</div>
    </section>
  );
}
