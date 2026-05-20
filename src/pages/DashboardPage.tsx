import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { BillingPanel, type SubscriptionRow } from "../features/billing/BillingPanel";
import { PricingCards } from "../features/billing/PricingCards";
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
  type ProAnalysisResponse
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

export function DashboardPage({ onAdminOpen, onReportOpen }: DashboardPageProps = {}) {
  const { session, signOut, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [reports, setReports] = useState<ReportListRow[]>([]);
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
    if (!selectedDomain?.subscription_id) {
      return null;
    }

    return subscriptions.find((subscription) => subscription.id === selectedDomain.subscription_id) ?? null;
  }, [selectedDomain, subscriptions]);

  const selectedTierAiEnabled = selectedSubscription ? tierConfig[selectedSubscription.tier].aiEnabled : false;

  const loadSubscriptions = useCallback(async () => {
    if (!supabase || !user?.id) {
      setSubscriptions([]);
      return;
    }

    const { data } = await supabase
      .from("subscriptions")
      .select("id,tier,status,billing_interval,stripe_customer_id,current_period_start,current_period_end")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    setSubscriptions((data as SubscriptionRow[] | null) ?? []);
  }, [user?.id]);

  const loadDomains = useCallback(async () => {
    if (!supabase || !user?.id) {
      setDomains([]);
      return;
    }

    const { data } = await supabase
      .from("domains")
      .select("id,hostname,verification_status,verification_token,subscription_id,verified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setDomains((data as DomainRow[] | null) ?? []);
  }, [user?.id]);

  const loadReports = useCallback(async () => {
    if (!supabase || !user?.id) {
      setReports([]);
      return;
    }

    const { data } = await supabase
      .from("reports")
      .select("id,target_url,scan_type,summary,score,domain_id,created_at")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(20);

    setReports((data as ReportListRow[] | null) ?? []);
  }, [user?.id]);

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
    if (verifiedDomains.length === 0) {
      setSelectedDomainId("");
      return;
    }

    if (!verifiedDomains.find((domain) => domain.id === selectedDomainId)) {
      setSelectedDomainId(verifiedDomains[0].id);
    }
  }, [verifiedDomains, selectedDomainId]);

  async function handleScan(url: string) {
    if (!selectedDomain) {
      setError("Pick a verified domain before scanning.");
      return;
    }

    setError(null);
    setScanLoading(true);
    setPassiveResult(null);
    setProResult(null);

    try {
      const result = await runPassiveScan({
        accessToken: session?.access_token,
        domainId: selectedDomain.id,
        url
      });
      setPassiveResult(result);
      await loadReports();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Passive scan failed.");
    } finally {
      setScanLoading(false);
    }
  }

  async function handleProAnalysis({ context, mode }: { context: string; mode: ProAnalysisMode }) {
    if (!selectedDomain) {
      setError("Pick a verified domain first.");
      return;
    }

    const targetUrl = passiveResult?.finalUrl || `https://${selectedDomain.hostname}`;
    setError(null);
    setProLoading(true);

    try {
      const result = await runProAnalysis({
        accessToken: session?.access_token,
        context,
        domainId: selectedDomain.id,
        mode,
        url: targetUrl
      });
      setProResult(result);
      await loadReports();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "AI analysis failed.");
    } finally {
      setProLoading(false);
    }
  }

  function proLockedReason(): string | null {
    if (!selectedSubscription) {
      return "Pick a verified domain attached to an active subscription.";
    }

    if (!selectedTierAiEnabled) {
      return "AI review requires the Pro or Enterprise tier.";
    }

    if (!passiveResult) {
      return "Run a passive scan first so AI analysis has launch evidence to review.";
    }

    return null;
  }

  const activeSubscriptions = subscriptions.filter((subscription) =>
    subscription.status === "active" || subscription.status === "trialing"
  );

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
            <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {activeSubscriptions.length} active subscription{activeSubscriptions.length === 1 ? "" : "s"}
            </span>
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
        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Dashboard</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink">Launch dashboard</h1>
            <p className="mt-4 text-base leading-7 text-muted">
              Add a domain to a subscription, verify ownership via DNS, then run launch readiness scans.
            </p>
          </div>

          <Card className="p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-ink">Run a scan</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Choose a verified domain attached to one of your subscriptions. Each scan counts against the
                billing-period quota for that subscription.
              </p>
            </div>
            {verifiedDomains.length === 0 ? (
              <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
                No verified domains yet. Add a domain and verify the DNS TXT record below.
              </p>
            ) : (
              <>
                <label className="text-sm font-semibold text-ink" htmlFor="scan-domain">
                  Domain
                </label>
                <select
                  className="mt-2 mb-4 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
                  id="scan-domain"
                  onChange={(event) => setSelectedDomainId(event.target.value)}
                  value={selectedDomainId}
                >
                  {verifiedDomains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.hostname}
                    </option>
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
            {passiveResult ? (
              <p className="mt-3 text-xs text-muted">
                Quota: {passiveResult.quota.used}/{passiveResult.quota.limit} runs used this period.
              </p>
            ) : null}
          </Card>
        </section>

        <section className="mt-8">
          <BillingPanel accessToken={session?.access_token} subscriptions={subscriptions} />
        </section>

        <section className="mt-8" aria-labelledby="plans-heading">
          <h2 className="mb-4 text-2xl font-semibold text-ink" id="plans-heading">
            Add a subscription
          </h2>
          <PricingCards accessToken={session?.access_token} enableCheckout />
        </section>

        <section className="mt-8">
          <DomainsPanel
            accessToken={session?.access_token}
            domains={domains}
            onDomainsChanged={loadDomains}
            subscriptions={activeSubscriptions}
          />
        </section>

        <section className="mt-8">
          <ProModeSelector
            disabled={proLoading || !selectedTierAiEnabled}
            lockedReason={proLockedReason() ?? undefined}
            onRun={handleProAnalysis}
          />
        </section>

        <section className="mt-8" aria-labelledby="findings-heading">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-ink" id="findings-heading">
                Findings
              </h2>
              <p className="mt-2 text-sm text-muted">
                {passiveResult
                  ? `${passiveResult.summary} Last checked ${new Date(passiveResult.generatedAt).toLocaleString()}.${
                      passiveResult.htmlTruncated ? " HTML was truncated past 250 KB." : ""
                    }`
                  : "Awaiting first scan."}
              </p>
            </div>
            {passiveResult ? <p className="break-all text-sm font-semibold text-muted">{passiveResult.finalUrl}</p> : null}
          </div>
          <FindingList findings={passiveResult?.findings ?? []} />
        </section>

        <section className="mt-8">
          <Soc2Checklist checklist={proResult?.soc2 ?? passiveResult?.soc2 ?? null} />
        </section>

        <section className="mt-8" aria-labelledby="pro-findings-heading">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-ink" id="pro-findings-heading">
              AI analysis
            </h2>
            <p className="mt-2 text-sm text-muted">
              {proResult
                ? `${proResult.summary} Generated ${new Date(proResult.generatedAt).toLocaleString()}.`
                : selectedTierAiEnabled
                  ? "Run a Pro mode to see AI-prioritized launch risks."
                  : "AI analysis is included with the Pro and Enterprise tiers."}
            </p>
          </div>
          <FindingList findings={proResult?.aiFindings ?? []} />
        </section>

        <section className="mt-8" aria-labelledby="reports-heading">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold text-ink" id="reports-heading">
              Saved reports
            </h2>
            <p className="mt-2 text-sm text-muted">Server-saved reports for this account.</p>
            {reports.length === 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
                No saved reports yet.
              </p>
            ) : (
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
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
