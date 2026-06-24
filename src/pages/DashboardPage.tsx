import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { CtfCallout } from "../features/cta/CtfCallout";
import { DomainsPanel } from "../features/domains/DomainsPanel";
import { FindingList } from "../features/scans/FindingList";
import { ProModeSelector } from "../features/scans/ProModeSelector";
import { ScanForm } from "../features/scans/ScanForm";
import { Soc2Checklist } from "../features/scans/Soc2Checklist";
import {
  runPassiveScan,
  runProAnalysis,
  type DomainRow,
  type PassiveScanResponse,
  type ProAnalysisMode,
  type ProAnalysisResponse,
  type SubscriptionRow
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { tierConfig } from "../lib/tiers";

type ReportListRow = {
  created_at: string;
  domain_id: string;
  id: string;
  scan_type: string | null;
  score: number | null;
  summary: string | null;
  target_url: string | null;
};

type DashboardPageProps = {
  onAdminOpen?: () => void;
  onReportOpen?: (reportId: string) => void;
};

function SetupChecklist({
  hasVerifiedDomain,
  hasReport
}: {
  hasReport: boolean;
  hasVerifiedDomain: boolean;
}) {
  const steps = [
    { done: hasVerifiedDomain, label: "Verify your domain via DNS" },
    { done: hasReport, label: "Run your first free scan" }
  ];
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-ink">Getting started</h2>
      <p className="mt-2 text-sm text-muted">Add a domain below, verify it via DNS, then scan it free.</p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li
            className={`flex items-center gap-3 text-sm ${step.done ? "text-muted line-through" : i === nextIdx ? "font-semibold text-ink" : "text-muted"}`}
            key={step.label}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-accent/20 text-accent"
                  : i === nextIdx
                    ? "bg-accent text-page"
                    : "bg-panel text-muted ring-1 ring-line"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const REPORTS_LIMIT = 10;

export function DashboardPage({ onAdminOpen, onReportOpen }: DashboardPageProps = {}) {
  const { session, signOut, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [reports, setReports] = useState<ReportListRow[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [passiveResult, setPassiveResult] = useState<PassiveScanResponse | null>(null);
  const [proResult, setProResult] = useState<ProAnalysisResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [proLoading, setProLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const verifiedDomains = useMemo(
    () => domains.filter((domain) => domain.verification_status === "verified"),
    [domains]
  );

  const selectedDomain = useMemo(
    () => verifiedDomains.find((domain) => domain.id === selectedDomainId) ?? null,
    [verifiedDomains, selectedDomainId]
  );

  const selectedSubscription = useMemo(() => {
    if (!selectedDomain?.subscription_id) return null;
    return subscriptions.find((sub) => sub.id === selectedDomain.subscription_id) ?? null;
  }, [selectedDomain, subscriptions]);

  // AI (Groq) is available on the free comp tier; gate only on having run a passive scan.
  const aiEnabled = selectedSubscription ? tierConfig[selectedSubscription.tier]?.aiEnabled ?? true : true;

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === "active" || s.status === "trialing"),
    [subscriptions]
  );

  const hasVerifiedDomain = verifiedDomains.length > 0;
  const hasReport = reports.length > 0;
  const isSetupComplete = hasVerifiedDomain;

  const loadSubscriptions = useCallback(async () => {
    if (!supabase || !user?.id) { setSubscriptions([]); return; }
    const { data } = await supabase
      .from("subscriptions")
      .select("id,tier,status")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setSubscriptions((data as SubscriptionRow[] | null) ?? []);
  }, [user?.id]);

  const loadDomains = useCallback(async () => {
    if (!supabase || !user?.id) { setDomains([]); return; }
    const { data } = await supabase
      .from("domains")
      .select("id,hostname,verification_status,verification_token,subscription_id,verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setDomains((data as DomainRow[] | null) ?? []);
  }, [user?.id]);

  const loadReports = useCallback(async () => {
    if (!supabase || !user?.id) { setReports([]); setReportsTotal(0); return; }
    const offset = (reportsPage - 1) * REPORTS_LIMIT;
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "ready"),
      supabase
        .from("reports")
        .select("id,target_url,scan_type,summary,score,domain_id,created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .range(offset, offset + REPORTS_LIMIT - 1),
    ]);
    setReports((data as ReportListRow[] | null) ?? []);
    setReportsTotal(count ?? 0);
  }, [user?.id, reportsPage]);

  useEffect(() => {
    void loadSubscriptions();
    void loadDomains();
    void loadReports();

    if (supabase && user?.id) {
      supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(Boolean(data?.is_admin)));
    }
  }, [loadSubscriptions, loadDomains, loadReports, user?.id]);

  useEffect(() => {
    if (verifiedDomains.length === 0) { setSelectedDomainId(""); return; }
    if (!verifiedDomains.find((d) => d.id === selectedDomainId)) {
      setSelectedDomainId(verifiedDomains[0].id);
    }
  }, [verifiedDomains, selectedDomainId]);

  async function handleScan(url: string) {
    if (!selectedDomain) { setError("Pick a verified domain before scanning."); return; }
    setError(null);
    setScanLoading(true);
    setPassiveResult(null);
    setProResult(null);
    try {
      const result = await runPassiveScan({ accessToken: session?.access_token, domainId: selectedDomain.id, url });
      setPassiveResult(result);
      await loadReports();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Passive scan failed.");
    } finally {
      setScanLoading(false);
    }
  }

  async function handleProAnalysis({ context, mode }: { context: string; mode: ProAnalysisMode }) {
    if (!selectedDomain) { setError("Pick a verified domain first."); return; }
    const targetUrl = passiveResult?.finalUrl || `https://${selectedDomain.hostname}`;
    setError(null);
    setProLoading(true);
    try {
      const result = await runProAnalysis({ accessToken: session?.access_token, context, domainId: selectedDomain.id, mode, url: targetUrl });
      setProResult(result);
      await loadReports();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "AI analysis failed.");
    } finally {
      setProLoading(false);
    }
  }

  function proLockedReason(): string | null {
    if (!selectedSubscription) return "Pick a verified domain first.";
    if (!passiveResult) return "Run a passive scan first so AI analysis has launch evidence to review.";
    return null;
  }

  const lastReport = reports[0] ?? null;

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav
          aria-label="Dashboard"
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <div>
            <p className="text-lg font-semibold text-ink">Web Launch Guard</p>
            <p className="mt-1 break-words text-sm text-muted">{user?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            {isAdmin && onAdminOpen && (
              <Button className="min-h-10 px-3" onClick={onAdminOpen} variant="ghost">
                Admin
              </Button>
            )}
            <Button className="min-h-10 px-3" onClick={signOut} variant="ghost">
              Sign out
            </Button>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">

        {/* Setup progress — shown until user has a verified domain */}
        {!isSetupComplete && (
          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Dashboard</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink">Launch dashboard</h1>
              <p className="mt-4 text-base leading-7 text-muted">
                Add your domain, verify it via DNS, then run free launch-readiness scans as often as you like.
              </p>
            </div>
            <SetupChecklist hasReport={hasReport} hasVerifiedDomain={hasVerifiedDomain} />
          </section>
        )}

        {/* Compact header when setup is done */}
        {isSetupComplete && (
          <section className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Dashboard</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-4xl font-semibold leading-tight text-ink">Launch dashboard</h1>
              {lastReport && (
                <div className="rounded-lg border border-line bg-panel px-4 py-3 text-sm">
                  <span className="text-muted">Last scan score: </span>
                  <span className="font-semibold text-ink">{lastReport.score ?? "?"}</span>
                  <span className="text-muted"> on {new Date(lastReport.created_at).toLocaleDateString()}</span>
                  <button
                    className="ml-3 font-semibold text-accent hover:text-accent-strong"
                    onClick={() => onReportOpen?.(lastReport.id)}
                    type="button"
                  >
                    View report →
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Scan panel — shown once setup is complete */}
        {isSetupComplete && (
          <section className="mb-8">
            <Card className="p-6">
              <div className="mb-5">
                <h2 className="text-2xl font-semibold text-ink">Run a scan</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Choose a verified domain and enter its URL. Scans are free.
                </p>
              </div>
              {verifiedDomains.length === 0 ? (
                <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
                  No verified domains yet. Add and verify a domain below.
                </p>
              ) : (
                <>
                  <label className="text-sm font-semibold text-ink" htmlFor="scan-domain">
                    Domain
                  </label>
                  <select
                    className="mt-2 mb-4 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
                    id="scan-domain"
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    value={selectedDomainId}
                  >
                    {verifiedDomains.map((d) => (
                      <option key={d.id} value={d.id}>{d.hostname}</option>
                    ))}
                  </select>
                  <ScanForm disabled={scanLoading} onSubmit={handleScan} />
                </>
              )}
              {error ? (
                <p className="mt-5 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
                  {error}
                </p>
              ) : null}
            </Card>
          </section>
        )}

        {/* Findings — shown after a scan */}
        {isSetupComplete && (
          <>
            <section className="mb-8" aria-labelledby="findings-heading">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-ink" id="findings-heading">Findings</h2>
                  <p className="mt-2 text-sm text-muted">
                    {passiveResult
                      ? `${passiveResult.summary} Last checked ${new Date(passiveResult.generatedAt).toLocaleString()}.${passiveResult.htmlTruncated ? " HTML was truncated past 250 KB." : ""}`
                      : hasReport
                        ? "Open a saved report to review findings, or run a new scan."
                        : "Run your first scan above to see launch-readiness signals here."}
                  </p>
                </div>
                {passiveResult ? <p className="break-all text-sm font-semibold text-muted">{passiveResult.finalUrl}</p> : null}
              </div>
              <FindingList findings={passiveResult?.findings ?? []} />
            </section>

            {/* CTF lead funnel — shown after any scan result */}
            {passiveResult && (
              <section className="mb-8">
                <CtfCallout hasFindings={passiveResult.findings.length > 0} />
              </section>
            )}

            <section className="mb-8">
              <Soc2Checklist checklist={proResult?.soc2 ?? passiveResult?.soc2 ?? null} />
            </section>

            {aiEnabled && (
              <>
                <section className="mb-8">
                  <ProModeSelector
                    disabled={proLoading}
                    lockedReason={proLockedReason() ?? undefined}
                    onRun={handleProAnalysis}
                  />
                </section>
                <section className="mb-8" aria-labelledby="pro-findings-heading">
                  <div className="mb-4">
                    <h2 className="text-2xl font-semibold text-ink" id="pro-findings-heading">AI analysis</h2>
                    <p className="mt-2 text-sm text-muted">
                      {proResult
                        ? `${proResult.summary} Generated ${new Date(proResult.generatedAt).toLocaleString()}.`
                        : "Run a Pro mode to see AI-prioritized launch risks."}
                    </p>
                  </div>
                  <FindingList findings={proResult?.aiFindings ?? []} />
                </section>
              </>
            )}
          </>
        )}

        {/* Domains panel — always visible */}
        <section className="mb-8">
          <DomainsPanel
            accessToken={session?.access_token}
            domains={domains}
            onDomainsChanged={loadDomains}
            subscriptions={activeSubscriptions}
          />
        </section>

        {/* Saved reports */}
        <section className="mb-8" aria-labelledby="reports-heading">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold text-ink" id="reports-heading">Saved reports</h2>
            <p className="mt-2 text-sm text-muted">Server-saved reports for this account.</p>
            {reportsTotal === 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
                No saved reports yet. Complete setup above and run your first scan.
              </p>
            ) : (
              <>
                <ul className="mt-4 space-y-3" aria-label="Saved reports">
                  {reports.map((report) => (
                    <li
                      className="flex flex-col gap-2 rounded-lg border border-line bg-page p-3 sm:flex-row sm:items-center sm:justify-between"
                      key={report.id}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-ink">{report.target_url ?? "Untitled"}</p>
                        <p className="mt-1 text-xs text-muted">
                          {report.scan_type ?? "scan"} · score {report.score ?? "?"} · {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button onClick={() => onReportOpen?.(report.id)} variant="secondary">
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
                {reportsTotal > REPORTS_LIMIT && (
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      disabled={reportsPage <= 1}
                      onClick={() => setReportsPage((p) => p - 1)}
                      variant="secondary"
                    >
                      ← Prev
                    </Button>
                    <span className="text-xs text-muted">
                      {(reportsPage - 1) * REPORTS_LIMIT + 1}–{Math.min(reportsPage * REPORTS_LIMIT, reportsTotal)} of {reportsTotal}
                    </span>
                    <Button
                      disabled={reportsPage * REPORTS_LIMIT >= reportsTotal}
                      onClick={() => setReportsPage((p) => p + 1)}
                      variant="secondary"
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
