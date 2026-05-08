import type { ScanFinding } from "../../lib/api";

type FindingListProps = {
  findings: ScanFinding[];
};

const severityStyles = {
  high: "border-red-300 bg-red-50 text-red-800",
  low: "border-slate-300 bg-slate-50 text-slate-700",
  medium: "border-amber-300 bg-amber-50 text-amber-800"
};

export function FindingList({ findings }: FindingListProps) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-page px-4 py-5 text-sm text-muted">
        No findings yet. Run a scan on a verified domain to see launch-readiness signals here.
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Scan findings">
      {findings.map((finding) => (
        <li className="rounded-lg border border-line bg-page p-4" key={finding.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{finding.category}</p>
              <h3 className="mt-2 text-base font-semibold text-ink">{finding.title}</h3>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[finding.severity]}`}
            >
              {finding.severity}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">{finding.description}</p>
          {finding.evidence ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              <span className="font-semibold text-ink">Evidence:</span> {finding.evidence}
            </p>
          ) : null}
          {finding.remediation ? (
            <p className="mt-1 text-sm leading-6 text-muted">
              <span className="font-semibold text-ink">Remediation:</span> {finding.remediation}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
