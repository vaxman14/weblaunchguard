import { useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { CtfCallout } from "../features/cta/CtfCallout";
import { FindingList } from "../features/scans/FindingList";
import { Soc2Checklist } from "../features/scans/Soc2Checklist";
import { runDemoScan, submitLead, type DemoScanResponse, type LeadReportResponse } from "../lib/api";

const checks = [
  { title: "Security & headers", body: "CSP, HSTS, frame protection, cookie flags, and mixed-content checks." },
  { title: "SEO & visibility", body: "Title, meta description, Open Graph, canonical, and LocalBusiness structured data." },
  { title: "Conversion signals", body: "Click-to-call, contact paths, and online booking — the things that turn visitors into customers." },
  { title: "Accessibility & mobile", body: "Labels, headings, alt text, language, and mobile-readiness signals." }
];

type Phase = "idle" | "teaser" | "full";

function scoreBand(score: number) {
  if (score >= 80) return { label: "Looking good", color: "#067647" };
  if (score >= 50) return { label: "Needs work", color: "#b54708" };
  return { label: "At risk", color: "#b42318" };
}

export function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [teaser, setTeaser] = useState<DemoScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [full, setFull] = useState<LeadReportResponse | null>(null);

  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !agreed || scanning) return;
    setError(null);
    setScanning(true);
    setTeaser(null);
    setFull(null);
    try {
      const result = await runDemoScan(url.trim());
      setTeaser(result);
      setPhase("teaser");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitLead({ business, email, name, newsletter, url: teaser?.finalUrl || url.trim() });
      setFull(result);
      setPhase("full");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate your full report.");
    } finally {
      setSubmitting(false);
    }
  }

  const score = full?.riskScore ?? teaser?.riskScore ?? 0;
  const total = full?.totalFindings ?? teaser?.totalFindings ?? 0;
  const band = scoreBand(score);

  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8" aria-label="Primary">
          <a className="text-lg font-semibold text-ink" href="#top">Web Launch Guard</a>
          <div className="flex flex-wrap items-center gap-3">
            <a className="text-sm font-semibold text-muted hover:text-ink" href="#how-it-works">How it works</a>
            <a
              className="text-sm font-semibold text-muted hover:text-ink"
              href="https://ctfdesigns.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              CTF Designs
            </a>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="bg-page text-ink" id="top">
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Free website scanner</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-ink sm:text-6xl">
              Is your website costing you customers?
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted">
              Scan any site free in seconds for security, SEO, accessibility, and conversion gaps —
              then get the full report with fixes, emailed to you.
            </p>

            <form className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleScan}>
              <input
                aria-label="Your website URL"
                className="min-h-11 flex-1 rounded-lg border border-line bg-page px-4 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                disabled={scanning}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yoursite.com"
                required
                type="url"
                value={url}
              />
              <Button disabled={scanning || !agreed} type="submit">
                {scanning ? "Scanning…" : "Free scan"}
              </Button>
            </form>
            <label className="mx-auto mt-4 flex max-w-xl items-start justify-center gap-2 text-left text-sm text-muted" htmlFor="agree">
              <input
                checked={agreed}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-accent"
                id="agree"
                onChange={(e) => setAgreed(e.target.checked)}
                type="checkbox"
              />
              <span>
                I agree to the{" "}
                <a className="font-semibold text-accent hover:text-accent-strong" href="#terms">Terms of Service</a>{" "}
                and understand this is a free informational tool, not a professional security audit.
              </span>
            </label>
            {error && phase === "idle" ? (
              <p className="mx-auto mt-4 max-w-xl rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink" role="alert">{error}</p>
            ) : null}
          </div>
        </section>

        {/* Results */}
        {teaser ? (
          <section className="mx-auto w-full max-w-3xl px-6 pb-12 sm:px-8" ref={resultRef}>
            <Card className="p-6 sm:p-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Your scan</p>
                <h2 className="break-all text-xl font-semibold text-ink">{(full?.finalUrl ?? teaser.finalUrl)}</h2>
                <button
                  className="mt-3 flex flex-col items-center"
                  onClick={() => setShowScoreInfo(true)}
                  type="button"
                  aria-label="What does this score mean?"
                >
                  <span className="text-6xl font-semibold leading-none" style={{ color: band.color }}>{score}</span>
                  <span className="mt-1 text-sm text-muted">risk score / 100 · <span className="underline">what's this?</span></span>
                </button>
                <p className="mt-2 text-sm font-semibold" style={{ color: band.color }}>{band.label} — {total} issue{total === 1 ? "" : "s"} found</p>
              </div>

              {/* Full report (after lead) or teaser */}
              {phase === "full" && full ? (
                <div className="mt-8">
                  <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-ink">
                    ✓ Full report {full.emailed ? <>emailed to <b>{email}</b></> : "ready"}. Here's everything we found:
                  </div>
                  <FindingList findings={full.findings} />
                  {full.fixPlan && full.fixPlan.priorities.length > 0 ? (
                    <div className="mt-8 rounded-xl border border-accent/40 bg-accent/5 p-6">
                      <h3 className="text-xl font-semibold text-ink">How CTF Designs would fix this</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{full.fixPlan.intro}</p>
                      <div className="mt-5 space-y-5">
                        {full.fixPlan.priorities.map((p, i) => (
                          <div className="border-l-2 border-accent pl-4" key={i}>
                            <p className="font-semibold text-ink">{p.problem}</p>
                            {p.impact ? <p className="mt-1 text-sm text-muted">{p.impact}</p> : null}
                            <p className="mt-1 text-sm text-ink"><span className="font-semibold text-accent">How we'd fix it:</span> {p.fix}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-8"><Soc2Checklist checklist={full.soc2 ?? null} /></div>
                  <div className="mt-8"><CtfCallout hasFindings={full.findings.length > 0} /></div>
                </div>
              ) : (
                <div className="mt-8">
                  <p className="mb-3 text-sm font-semibold text-ink">A few of what we found:</p>
                  <FindingList findings={teaser.findings} />
                  <div className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-5">
                    <h3 className="text-lg font-semibold text-ink">Unlock your full report — free</h3>
                    <p className="mt-1 text-sm text-muted">
                      See all {total} issues, exactly how to fix each one, and get the report emailed to you.
                    </p>
                    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmitLead}>
                      <input className="min-h-11 rounded-lg border border-line bg-page px-3 text-sm text-ink focus:border-accent focus:outline-none"
                        placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Your name" />
                      <input className="min-h-11 rounded-lg border border-line bg-page px-3 text-sm text-ink focus:border-accent focus:outline-none"
                        placeholder="Business name" required value={business} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" aria-label="Business name" />
                      <input className="min-h-11 rounded-lg border border-line bg-page px-3 text-sm text-ink focus:border-accent focus:outline-none sm:col-span-2"
                        placeholder="Work email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Work email" />
                      <label className="flex items-start gap-2 text-left text-sm text-muted sm:col-span-2" htmlFor="newsletter">
                        <input checked={newsletter} className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-accent"
                          id="newsletter" onChange={(e) => setNewsletter(e.target.checked)} type="checkbox" />
                        <span>Send me occasional website tips from CTF Designs. No spam, unsubscribe anytime.</span>
                      </label>
                      <Button className="sm:col-span-2" disabled={submitting} type="submit">
                        {submitting ? "Building your report…" : "Get my full report →"}
                      </Button>
                    </form>
                    {error && phase === "teaser" ? (
                      <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink" role="alert">{error}</p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted">
                      We use your details only to send your report and (if you opt in) occasional tips. See our{" "}
                      <a className="underline hover:text-ink" href="#privacy">Privacy Policy</a>.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </section>
        ) : null}

        {/* What we check */}
        <section className="border-y border-line/80 bg-panel/55" aria-labelledby="checks-heading">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-semibold text-ink" id="checks-heading">What we check</h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted">
                A passive scan across the things that make a site safe, findable, and profitable — no login, no crawling.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {checks.map((c) => (
                <Card className="p-5" key={c.title}>
                  <h3 className="text-base font-semibold text-ink">{c.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{c.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8" id="how-it-works">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold text-ink">How it works</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Scan free", b: "Enter your URL and get an instant risk score with a preview of what's wrong." },
              { n: "2", t: "Get the full report", b: "Tell us where to send it — see every issue plus how to fix it, on screen and in your inbox." },
              { n: "3", t: "Fix it (or we will)", b: "Tackle it yourself, or have CTF Designs handle the whole thing." }
            ].map((s) => (
              <div key={s.n}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{s.n}</div>
                <h3 className="text-base font-semibold text-ink">{s.t}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line/80 bg-panel/55">
          <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8"><CtfCallout hasFindings={false} /></div>
        </section>
      </main>

      <footer className="border-t border-line/80 bg-panel/70">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">© 2026 Web Launch Guard. A free marketing tool by CTF Designs, provided as-is with no warranty.</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <a className="text-muted hover:text-accent" href="#privacy">Privacy</a>
              <a className="text-muted hover:text-accent" href="#terms">Terms</a>
              <a className="text-muted hover:text-accent" href="#eula">EULA</a>
              <a className="text-muted hover:text-accent" href="#cookies">Cookies</a>
              <a className="inline-flex items-center gap-1.5 text-xs text-muted opacity-50 hover:opacity-100" href="https://ctfdesigns.com" target="_blank" rel="noopener noreferrer">Built by CTF Designs</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Score explainer modal */}
      {showScoreInfo ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowScoreInfo(false)} role="presentation">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-page p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How the score works">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-semibold text-ink">How the score works</h2>
              <button className="text-2xl leading-none text-muted hover:text-ink" onClick={() => setShowScoreInfo(false)} aria-label="Close">×</button>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Every site starts at <b className="text-ink">100</b>. We run a passive scan across security, SEO,
              accessibility, mobile, and conversion best practices, and each issue we find deducts points by severity:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-3"><span className="inline-block w-16 font-semibold" style={{ color: "#b42318" }}>High</span><span className="text-muted">−10 each — serious or high-impact issues</span></li>
              <li className="flex items-center gap-3"><span className="inline-block w-16 font-semibold" style={{ color: "#b54708" }}>Medium</span><span className="text-muted">−5 each — should be fixed before launch</span></li>
              <li className="flex items-center gap-3"><span className="inline-block w-16 font-semibold" style={{ color: "#475467" }}>Low</span><span className="text-muted">−2 each — polish and best practices</span></li>
            </ul>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-line p-2"><div className="text-base font-semibold" style={{ color: "#067647" }}>80–100</div><div className="text-muted">Looking good</div></div>
              <div className="rounded-lg border border-line p-2"><div className="text-base font-semibold" style={{ color: "#b54708" }}>50–79</div><div className="text-muted">Needs work</div></div>
              <div className="rounded-lg border border-line p-2"><div className="text-base font-semibold" style={{ color: "#b42318" }}>0–49</div><div className="text-muted">At risk</div></div>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted">
              The score is a quick, automated starting point — not a certified audit or a guarantee. It's meant to
              highlight where a site likely needs attention so CTF Designs can help you prioritize.
            </p>
            <Button className="mt-5 w-full" onClick={() => setShowScoreInfo(false)}>Got it</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
