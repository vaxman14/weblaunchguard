import { useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { PricingCards } from "../features/billing/PricingCards";
import { FindingList } from "../features/scans/FindingList";
import { runDemoScan, type DemoScanResponse } from "../lib/api";

const checks = [
  {
    body: "Checks for Content-Security-Policy, HSTS, X-Frame-Options, Referrer-Policy, and Permissions-Policy.",
    title: "Security headers"
  },
  {
    body: "Flags missing HttpOnly and Secure attributes, SameSite policies, and third-party tracking cookies.",
    title: "Cookie hygiene"
  },
  {
    body: "Detects missing lang attributes, poor color contrast signals, absent viewport meta, and form labeling gaps.",
    title: "Accessibility signals"
  },
  {
    body: "Verifies HTTPS enforcement, HSTS presence, and catches mixed-content issues before your users do.",
    title: "Transport security"
  }
];

const howItWorks = [
  { body: "Add a TXT record to your DNS to prove you control the domain. Takes about 2 minutes.", label: "1", title: "Verify your domain" },
  { body: "We fetch your public homepage passively — no credentials, no sessions, no crawling.", label: "2", title: "Run a passive scan" },
  { body: "Get a risk score, severity-ranked findings, and a SOC 2-aligned checklist in seconds.", label: "3", title: "Review your report" },
  { body: "Share a public link with clients or teammates, or export the full report as PDF.", label: "4", title: "Share results" }
];

type HomePageProps = {
  onAuthOpen?: () => void;
  onSampleReport?: () => void;
};

export function HomePage({ onAuthOpen, onSampleReport }: HomePageProps) {
  const [demoUrl, setDemoUrl] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoScanResponse | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);

  async function handleDemoScan(e: React.FormEvent) {
    e.preventDefault();
    if (!demoUrl.trim()) return;

    setDemoError(null);
    setDemoResult(null);
    setDemoLoading(true);

    try {
      const result = await runDemoScan(demoUrl.trim());
      setDemoResult(result);
      setTimeout(() => demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Demo scan failed.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav
          aria-label="Primary"
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <a className="text-lg font-semibold text-ink" href="#top">
            Web Launch Guard
          </a>
          <div className="flex flex-wrap items-center gap-3">
            <a className="text-sm font-semibold text-muted hover:text-ink" href="#how-it-works">
              How it works
            </a>
            <button
              className="text-sm font-semibold text-muted hover:text-ink"
              onClick={onSampleReport}
              type="button"
            >
              Sample report
            </button>
            <a className="text-sm font-semibold text-muted hover:text-ink" href="#pricing">
              Pricing
            </a>
            <ThemeToggle />
            <Button className="min-h-10 px-3" onClick={onAuthOpen} variant="ghost">
              Log in
            </Button>
            <Button className="min-h-10 px-3" onClick={onAuthOpen}>
              Sign up
            </Button>
          </div>
        </nav>
      </header>

      <main className="bg-page text-ink" id="top">
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Launch readiness scanner
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-ink sm:text-6xl">
              Ship with confidence.<br className="hidden sm:block" /> Catch security gaps first.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted">
              Web Launch Guard passively scans your public homepage for security headers, cookie hygiene,
              accessibility signals, and transport security — then generates a shareable launch report in seconds.
            </p>
            <p className="mt-3 text-sm text-muted">
              Passive scan only — we never log in, crawl, or touch your backend.
            </p>

            {/* Demo scan input */}
            <form className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleDemoScan}>
              <input
                aria-label="Your site URL"
                className="min-h-11 flex-1 rounded-lg border border-line bg-page px-4 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                disabled={demoLoading}
                onChange={(e) => setDemoUrl(e.target.value)}
                placeholder="https://yoursite.com"
                required
                type="url"
                value={demoUrl}
              />
              <Button disabled={demoLoading} type="submit">
                {demoLoading ? "Scanning…" : "Free scan"}
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                className="text-sm font-semibold text-muted hover:text-ink"
                onClick={onSampleReport}
                type="button"
              >
                See a sample report →
              </button>
              <button
                className="text-sm font-semibold text-muted hover:text-ink"
                onClick={onAuthOpen}
                type="button"
              >
                Sign up for full access →
              </button>
            </div>
          </div>
        </section>

        {/* Demo results */}
        {(demoResult || demoError) ? (
          <section className="mx-auto w-full max-w-6xl px-6 pb-8 sm:px-8" ref={demoRef}>
            <Card className="p-6">
              {demoError ? (
                <p className="text-sm text-ink" role="alert">{demoError}</p>
              ) : demoResult ? (
                <>
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">demo scan</p>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">{demoResult.finalUrl}</h2>
                      <p className="mt-2 text-sm text-muted">{demoResult.summary}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-4xl font-semibold text-ink">{demoResult.riskScore}</p>
                      <p className="text-sm text-muted">risk score</p>
                    </div>
                  </div>
                  <FindingList findings={demoResult.findings} />
                  <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-4">
                    <p className="text-sm font-semibold text-ink">
                      {demoResult.totalFindings > demoResult.findings.length
                        ? `Showing ${demoResult.findings.length} of ${demoResult.totalFindings} findings.`
                        : "This is a preview — your full report includes detailed remediation steps and a SOC 2-aligned checklist."}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Create a free account to unlock the complete report, track fixes, and share a public link with your team.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Button onClick={onAuthOpen}>Get full report — it's free</Button>
                      <Button onClick={onSampleReport} variant="secondary">See a sample first</Button>
                    </div>
                  </div>
                </>
              ) : null}
            </Card>
          </section>
        ) : null}

        {/* What We Check */}
        <section className="border-y border-line/80 bg-panel/55" aria-labelledby="checks-heading">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-semibold text-ink" id="checks-heading">
                What we check
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted">
                14 passive checks across four critical launch categories. No authentication required — we only read what the public internet sees.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {checks.map((check) => (
                <Card className="p-5" key={check.title}>
                  <h3 className="text-base font-semibold text-ink">{check.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{check.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8" aria-labelledby="how-it-works" id="how-it-works">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold text-ink" id="how-it-works">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted">
              From signup to shareable report in under 5 minutes.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step) => (
              <div className="relative" key={step.title}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {step.label}
                </div>
                <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button onClick={onAuthOpen}>Get started free</Button>
            <p className="mt-3 text-sm text-muted">No credit card required. Try the demo scan above.</p>
          </div>
        </section>

        {/* Pricing */}
        <section
          aria-labelledby="pricing-heading"
          className="border-t border-line/80 bg-panel/55"
          id="pricing"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-semibold text-ink" id="pricing-heading">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted">
                Each domain is verified by DNS before any scan runs. Plans scale with your launch volume.
              </p>
            </div>
            <PricingCards />
            <p className="mt-6 text-center text-sm text-muted">
              <button className="font-semibold text-accent hover:text-accent-strong" onClick={onAuthOpen} type="button">
                Sign up
              </button>
              {" "}to choose a plan and start scanning.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/80 bg-panel/70">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              © 2026 Web Launch Guard.
            </p>
            <div className="flex flex-wrap gap-4 text-sm items-center">
              <a className="text-muted hover:text-accent" href="#privacy">Privacy Policy</a>
              <a className="text-muted hover:text-accent" href="#terms">Terms of Service</a>
              <a className="text-muted hover:text-accent" href="#eula">EULA</a>
              <a className="text-muted hover:text-accent" href="#cookies">Cookie Policy</a>
              <a className="inline-flex items-center gap-1.5 text-xs text-muted opacity-50 hover:opacity-100 transition-opacity" href="https://ctfdesigns.com" target="_blank" rel="noopener noreferrer">
                <img src="https://ctfdesigns.com/images/logo.png" alt="CTF Designs" className="w-4 h-4 rounded-full object-cover" />
                Built by CTF Designs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
