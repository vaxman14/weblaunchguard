import { Copy, Download, Link, LockKeyhole, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FindingList } from "../features/scans/FindingList";
import { Soc2Checklist } from "../features/scans/Soc2Checklist";
import {
  createShareToken,
  exportReportPdf,
  revokeShareToken,
  type ScanFinding,
  type Soc2Checklist as Soc2ChecklistType
} from "../lib/api";
import { supabase } from "../lib/supabase";

type ReportPageProps = {
  accessToken?: string | null;
  onBack: () => void;
  reportId: string;
};

type ReportRow = {
  created_at: string;
  domain_id: string;
  id: string;
  payload: { soc2?: Soc2ChecklistType } | null;
  scan_type: string | null;
  score: number | null;
  summary: string | null;
  target_url: string | null;
};

type FindingRow = {
  category: string | null;
  description: string | null;
  evidence: { note?: string } | null;
  id: string;
  remediation: string | null;
  severity: "low" | "medium" | "high" | null;
  title: string;
};

type DomainRow = { hostname: string };

const severityRank: Record<"high" | "medium" | "low", number> = { high: 0, low: 2, medium: 1 };

export function ReportPage({ accessToken, onBack, reportId }: ReportPageProps) {
  const [report, setReport] = useState<ReportRow | null>(null);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [domain, setDomain] = useState<DomainRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: reportData, error: reportError } = await supabase!
        .from("reports")
        .select("id,target_url,scan_type,summary,score,domain_id,payload,created_at,share_token")
        .eq("id", reportId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (reportError || !reportData) {
        setError("Report could not be loaded.");
        setLoading(false);
        return;
      }

      const reportRow = reportData as ReportRow & { share_token?: string | null };
      setReport(reportRow);
      setShareToken(reportRow.share_token ?? null);

      const [findingsResult, domainResult] = await Promise.all([
        supabase!
          .from("findings")
          .select("id,category,description,evidence,remediation,severity,title")
          .eq("report_id", reportId)
          .order("created_at", { ascending: true }),
        supabase!.from("domains").select("hostname").eq("id", (reportData as ReportRow).domain_id).maybeSingle()
      ]);

      if (cancelled) {
        return;
      }

      setFindings(((findingsResult.data as FindingRow[] | null) ?? []));
      setDomain((domainResult.data as DomainRow | null) ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const sortedFindings: ScanFinding[] = useMemo(() => {
    return findings
      .map((finding) => ({
        category: finding.category ?? "general",
        description: finding.description ?? "",
        evidence: finding.evidence?.note ?? undefined,
        id: finding.id,
        remediation: finding.remediation ?? undefined,
        severity: finding.severity ?? "low",
        title: finding.title
      }))
      .sort((left, right) => severityRank[left.severity] - severityRank[right.severity]);
  }, [findings]);

  function shareUrl(token: string) {
    return `${window.location.origin}${window.location.pathname}?share=${token}`;
  }

  async function handleShare() {
    if (!report) return;
    setShareLoading(true);
    setError(null);
    try {
      const { share_token } = await createShareToken({ accessToken, reportId: report.id });
      setShareToken(share_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link.");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRevoke() {
    if (!report) return;
    setShareLoading(true);
    setError(null);
    try {
      await revokeShareToken({ accessToken, reportId: report.id });
      setShareToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke share link.");
    } finally {
      setShareLoading(false);
    }
  }

  function handleCopy() {
    if (!shareToken) return;
    void navigator.clipboard.writeText(shareUrl(shareToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExport() {
    setError(null);
    setExporting(true);

    try {
      const blob = await exportReportPdf({ accessToken, reportId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `web-launch-guard-${reportId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav aria-label="Report" className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <div>
            <p className="text-lg font-semibold text-ink">Web Launch Guard</p>
            <p className="mt-1 text-sm text-muted">Saved report</p>
          </div>
          <Button onClick={onBack} variant="ghost">
            Back to dashboard
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
        {loading ? (
          <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
            Loading report.
          </p>
        ) : !report ? (
          <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
            {error ?? "Report could not be loaded."}
          </p>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">{report.scan_type ?? "scan"}</p>
                <h1 className="mt-3 break-words text-4xl font-semibold leading-tight text-ink">
                  {domain?.hostname ?? "(unknown domain)"}
                </h1>
                <p className="mt-4 break-all text-sm text-muted">{report.target_url}</p>
                <p className="mt-4 text-base leading-7 text-muted">{report.summary ?? "No summary."}</p>
              </div>

              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <LockKeyhole aria-hidden="true" size={18} />
                  Server-saved report
                </div>
                <p className="mt-4 text-5xl font-semibold text-ink">{report.score ?? "?"}</p>
                <p className="mt-2 text-sm text-muted">Risk score</p>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Created {new Date(report.created_at).toLocaleString()}.
                </p>
                <Button className="mt-5 w-full" disabled={exporting} onClick={handleExport}>
                  <Download aria-hidden="true" size={18} />
                  {exporting ? "Exporting" : "Export PDF"}
                </Button>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-[0.12em]">Share</p>
                  {shareToken ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-2">
                        <input
                          aria-label="Share link"
                          className="min-w-0 flex-1 bg-transparent text-xs text-muted focus:outline-none"
                          readOnly
                          value={shareUrl(shareToken)}
                        />
                        <button
                          aria-label="Copy link"
                          className="shrink-0 text-muted hover:text-ink"
                          onClick={handleCopy}
                          type="button"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      {copied && <p className="mt-1 text-xs text-accent">Copied!</p>}
                      <button
                        className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-ink"
                        disabled={shareLoading}
                        onClick={handleRevoke}
                        type="button"
                      >
                        <X size={12} />
                        {shareLoading ? "Revoking…" : "Revoke link"}
                      </button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={shareLoading}
                      onClick={handleShare}
                      variant="secondary"
                    >
                      <Link aria-hidden="true" size={14} />
                      {shareLoading ? "Creating link…" : "Create share link"}
                    </Button>
                  )}
                </div>
              </Card>
            </section>

            {error ? (
              <p className="mt-6 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
                {error}
              </p>
            ) : null}

            <section className="mt-8" aria-labelledby="report-findings-heading">
              <h2 className="mb-4 text-2xl font-semibold text-ink" id="report-findings-heading">
                Findings by severity
              </h2>
              <FindingList findings={sortedFindings} />
            </section>

            <section className="mt-8">
              <Soc2Checklist checklist={report.payload?.soc2 ?? null} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
