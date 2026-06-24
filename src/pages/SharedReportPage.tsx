import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CtfCallout } from "../features/cta/CtfCallout";
import { FindingList } from "../features/scans/FindingList";
import { Soc2Checklist } from "../features/scans/Soc2Checklist";
import { fetchPublicReport, type PublicReportResponse, type ScanFinding } from "../lib/api";

type SharedReportPageProps = {
  onAuthOpen?: () => void;
  shareToken: string;
};

const severityRank: Record<"high" | "medium" | "low", number> = { high: 0, low: 2, medium: 1 };

export function SharedReportPage({ onAuthOpen, shareToken }: SharedReportPageProps) {
  const [data, setData] = useState<PublicReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchPublicReport(shareToken)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Report could not be loaded.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const sortedFindings: ScanFinding[] = useMemo(() => {
    if (!data) return [];
    return data.findings
      .map((f) => ({
        category: f.category ?? "general",
        description: f.description ?? "",
        evidence: f.evidence?.note ?? undefined,
        id: f.id,
        remediation: f.remediation ?? undefined,
        severity: f.severity ?? "low",
        title: f.title
      }))
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  }, [data]);

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav aria-label="Shared report" className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <div>
            <p className="text-lg font-semibold text-ink">Web Launch Guard</p>
            <p className="mt-1 text-sm text-muted">Shared report</p>
          </div>
          <Button onClick={onAuthOpen}>
            Scan my site
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
        {loading ? (
          <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
            Loading report.
          </p>
        ) : error || !data ? (
          <div className="rounded-lg border border-line bg-page px-4 py-6">
            <p className="text-sm text-ink" role="alert">{error ?? "This report is not available."}</p>
            <Button className="mt-4" onClick={onAuthOpen} variant="secondary">
              Scan your own site
            </Button>
          </div>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                  {data.report.scan_type ?? "scan"}
                </p>
                <h1 className="mt-3 break-words text-4xl font-semibold leading-tight text-ink">
                  {data.domain?.hostname ?? "(unknown domain)"}
                </h1>
                <p className="mt-4 break-all text-sm text-muted">{data.report.target_url}</p>
                <p className="mt-4 text-base leading-7 text-muted">{data.report.summary ?? "No summary."}</p>
              </div>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Risk score</p>
                <p className="mt-3 text-5xl font-semibold text-ink">{data.report.score ?? "?"}</p>
                <p className="mt-2 text-sm text-muted">out of 100 (higher is better)</p>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Scanned {new Date(data.report.created_at).toLocaleDateString()}.
                </p>
                <Button className="mt-5 w-full" onClick={onAuthOpen}>
                  Scan my site
                </Button>
              </Card>
            </section>

            <section className="mt-8" aria-labelledby="shared-findings-heading">
              <h2 className="mb-4 text-2xl font-semibold text-ink" id="shared-findings-heading">
                Findings by severity
              </h2>
              <FindingList findings={sortedFindings} />
            </section>

            <section className="mt-8">
              <Soc2Checklist checklist={data.report.payload?.soc2 ?? null} />
            </section>

            <section className="mt-10">
              <CtfCallout hasFindings={sortedFindings.length > 0} />
            </section>

            <section className="mt-8 rounded-xl border border-line bg-panel/60 px-6 py-8 text-center">
              <h2 className="text-2xl font-semibold text-ink">Get your own launch report</h2>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted">
                Verify your domain, run a scan, and share results with your team in minutes. Free.
              </p>
              <Button className="mt-6" onClick={onAuthOpen}>
                Start for free
              </Button>
            </section>
          </>
        )}
      </main>
    </>
  );
}
