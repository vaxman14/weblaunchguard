import { Download } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FindingList } from "../features/scans/FindingList";
import { Soc2Checklist } from "../features/scans/Soc2Checklist";
import type { ScanFinding, Soc2Checklist as Soc2ChecklistType } from "../lib/api";

type SampleReportPageProps = {
  onAuthOpen?: () => void;
  onBack?: () => void;
};

const sampleFindings: ScanFinding[] = [
  {
    category: "security-headers",
    description:
      "No Content-Security-Policy header was returned. Without a CSP, browsers will load scripts, styles, and frames from any origin — leaving your app open to cross-site scripting and data injection attacks.",
    evidence: "Header absent from HTTP response",
    id: "csp-missing",
    remediation:
      "Add a Content-Security-Policy header. Start with a restrictive policy like `default-src 'self'` and expand only what your assets require.",
    severity: "high",
    title: "Missing Content-Security-Policy"
  },
  {
    category: "transport",
    description:
      "HTTP Strict Transport Security (HSTS) was not returned. Without HSTS, browsers may silently downgrade HTTPS connections to HTTP on subsequent visits, enabling man-in-the-middle attacks.",
    evidence: "Strict-Transport-Security header absent",
    id: "hsts-missing",
    remediation:
      "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to all HTTPS responses. After testing, add the `preload` directive and submit to the HSTS preload list.",
    severity: "medium",
    title: "HSTS not enforced"
  },
  {
    category: "cookies",
    description:
      "One or more session cookies were set without the HttpOnly flag. JavaScript running on the page can read these cookies, which makes credential theft possible if an XSS vulnerability is exploited.",
    evidence: "Set-Cookie: session=abc123; Path=/",
    id: "cookie-httponly",
    remediation: "Add the HttpOnly attribute to all session and auth cookies: Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict",
    severity: "medium",
    title: "Session cookie missing HttpOnly"
  },
  {
    category: "privacy-headers",
    description:
      "The Referrer-Policy header is absent. By default browsers send the full URL in the Referer header when linking out, which may leak sensitive path or query parameters to third parties.",
    evidence: "Referrer-Policy header absent",
    id: "referrer-policy",
    remediation: "Add `Referrer-Policy: strict-origin-when-cross-origin` to reduce referrer leakage without breaking analytics.",
    severity: "low",
    title: "No Referrer-Policy"
  },
  {
    category: "accessibility",
    description:
      "The page does not declare a language attribute on the <html> element. Screen readers use this to select the correct voice profile. Missing it causes mispronunciation for users relying on assistive technology.",
    evidence: '<html> element has no lang attribute',
    id: "lang-missing",
    remediation: 'Add the lang attribute to the root element: <html lang="en">',
    severity: "low",
    title: "Missing html lang attribute"
  },
  {
    category: "security-headers",
    description:
      "The X-Frame-Options header is absent. Without it, your site can be embedded in a hidden iframe on an attacker-controlled page, enabling clickjacking attacks against your users.",
    evidence: "X-Frame-Options header absent",
    id: "xframe-missing",
    remediation: "Add `X-Frame-Options: DENY` or set `frame-ancestors 'none'` in your Content-Security-Policy.",
    severity: "low",
    title: "Clickjacking protection missing"
  }
];

const sampleSoc2: Soc2ChecklistType = {
  generatedAt: "2026-05-20T10:00:00Z",
  items: [
    {
      control: "CC6.1",
      criterion: "Logical and Physical Access Controls",
      description: "The entity implements logical access controls to protect against threats from sources outside its system boundaries.",
      evidence: "HTTPS enforced via 301 redirect from HTTP",
      id: "cc6.1",
      passing: true,
      rationale: "Site enforces HTTPS for all traffic",
      severity: "low",
      title: "Transport encryption"
    },
    {
      control: "CC6.7",
      criterion: "Logical and Physical Access Controls",
      description: "The entity restricts the transmission of data to authorized recipients.",
      evidence: "Content-Security-Policy header absent",
      id: "cc6.7",
      passing: false,
      rationale: "No CSP means data can be exfiltrated via injected scripts",
      severity: "high",
      title: "Content Security Policy"
    },
    {
      control: "CC9.1",
      criterion: "Risk Mitigation",
      description: "The entity identifies, selects, and develops risk mitigation activities.",
      evidence: "HSTS header absent",
      id: "cc9.1",
      passing: false,
      rationale: "Without HSTS, attackers can downgrade connections",
      severity: "medium",
      title: "HSTS enforcement"
    },
    {
      control: "A1.1",
      criterion: "Availability",
      description: "The entity maintains, monitors, and evaluates current processing capacity.",
      evidence: "HTTP 200 response returned in 310ms",
      id: "a1.1",
      passing: true,
      rationale: "Site responded within acceptable threshold",
      severity: "low",
      title: "Site availability"
    }
  ],
  passed: 2,
  total: 4
};

export function SampleReportPage({ onAuthOpen, onBack }: SampleReportPageProps) {
  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav aria-label="Sample report" className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <div>
            <p className="text-lg font-semibold text-ink">Web Launch Guard</p>
            <p className="mt-1 text-sm text-muted">Sample report</p>
          </div>
          <div className="flex items-center gap-3">
            {onBack ? (
              <Button onClick={onBack} variant="ghost">
                Back
              </Button>
            ) : null}
            <Button onClick={onAuthOpen}>
              Scan my site
            </Button>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
        <div className="mb-2 rounded-lg border border-line bg-panel/60 px-4 py-3 text-sm text-muted">
          This is a sample report generated from a fictional site. Real reports include your domain, live evidence, and a shareable link.
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">passive scan</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink">acme.io</h1>
            <p className="mt-4 break-all text-sm text-muted">https://acme.io</p>
            <p className="mt-4 text-base leading-7 text-muted">
              6 findings across security headers, transport, cookies, and accessibility. 2 require immediate attention before launch.
            </p>
          </div>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Risk score</p>
            <p className="mt-3 text-5xl font-semibold text-ink">61</p>
            <p className="mt-2 text-sm text-muted">out of 100 (higher is better)</p>
            <p className="mt-4 text-sm leading-6 text-muted">
              Scanned {new Date("2026-05-20T10:00:00Z").toLocaleDateString()}.
            </p>
            <Button
              className="mt-5 w-full"
              disabled
              onClick={onAuthOpen}
            >
              <Download aria-hidden="true" size={18} />
              Export PDF
            </Button>
            <p className="mt-2 text-xs text-muted">Sign in to export</p>
          </Card>
        </section>

        <section className="mt-8" aria-labelledby="sample-findings-heading">
          <h2 className="mb-4 text-2xl font-semibold text-ink" id="sample-findings-heading">
            Findings by severity
          </h2>
          <FindingList findings={sampleFindings} />
        </section>

        <section className="mt-8">
          <Soc2Checklist checklist={sampleSoc2} />
        </section>

        <section className="mt-10 rounded-xl border border-line bg-panel/60 px-6 py-8 text-center">
          <h2 className="text-2xl font-semibold text-ink">Ready to scan your site?</h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted">
            Sign up to get your full report — unlimited findings, SOC 2 checklist, PDF export, and shareable links.
          </p>
          <Button className="mt-6" onClick={onAuthOpen}>
            Start for free
          </Button>
        </section>
      </main>
    </>
  );
}
