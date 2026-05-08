import type { ScanFinding } from "./scan-engine";

// SOC 2 Trust Services Criteria mapping. The Common Criteria (CC) shorthand
// is widely used in published SOC 2 reports; references included here are the
// 2017 / 2022 revisions of the AICPA TSP.

export type Soc2ChecklistItem = {
  control: string;
  criterion: string;
  description: string;
  evidence: string;
  id: string;
  passing: boolean;
  rationale: string;
  severity: "low" | "medium" | "high";
  title: string;
};

export type Soc2Checklist = {
  generatedAt: string;
  items: Soc2ChecklistItem[];
  passed: number;
  total: number;
};

type Rule = {
  control: string;
  criterion: string;
  description: string;
  failsOnFindingId: string;
  failureRationale: string;
  id: string;
  passingRationale: string;
  severity: "low" | "medium" | "high";
  title: string;
};

const rules: Rule[] = [
  {
    control: "CC6.7",
    criterion: "CC6.7 — Restrict transmission of information to authorized users",
    description: "Public traffic must be encrypted in transit.",
    failsOnFindingId: "https-not-used",
    failureRationale: "The final response was not served over HTTPS, so traffic is sent in plaintext.",
    id: "soc2-https",
    passingRationale: "Final response was served over HTTPS.",
    severity: "high",
    title: "Encryption in transit (HTTPS)"
  },
  {
    control: "CC6.6",
    criterion: "CC6.6 — Logical access security measures",
    description: "Strict-Transport-Security forces HTTPS on follow-on requests.",
    failsOnFindingId: "missing-hsts",
    failureRationale: "Strict-Transport-Security was not present, so browsers can fall back to HTTP.",
    id: "soc2-hsts",
    passingRationale: "HSTS is configured on responses.",
    severity: "medium",
    title: "HTTP Strict Transport Security"
  },
  {
    control: "CC6.6",
    criterion: "CC6.6 — Logical access security measures",
    description: "A Content-Security-Policy mitigates injected script execution.",
    failsOnFindingId: "missing-csp",
    failureRationale: "No Content-Security-Policy was detected in headers or meta.",
    id: "soc2-csp",
    passingRationale: "Content-Security-Policy is present.",
    severity: "medium",
    title: "Content-Security-Policy"
  },
  {
    control: "CC6.6",
    criterion: "CC6.6 — Logical access security measures",
    description: "Frame protection blocks click-jacking risks against authenticated UI.",
    failsOnFindingId: "missing-frame-protection",
    failureRationale: "Neither X-Frame-Options nor a CSP frame-ancestors directive was sent.",
    id: "soc2-frame-protection",
    passingRationale: "Frame protection is configured.",
    severity: "low",
    title: "Click-jacking protection"
  },
  {
    control: "CC6.7",
    criterion: "CC6.7 — Restrict transmission of information",
    description: "Referrer-Policy limits leakage of URLs to third parties.",
    failsOnFindingId: "missing-referrer-policy",
    failureRationale: "Referrer-Policy was missing, so internal URLs may leak in cross-site requests.",
    id: "soc2-referrer-policy",
    passingRationale: "Referrer-Policy is configured.",
    severity: "low",
    title: "Referrer leakage controls"
  },
  {
    control: "CC6.1",
    criterion: "CC6.1 — Logical and physical access controls",
    description: "Permissions-Policy restricts access to powerful browser features.",
    failsOnFindingId: "missing-permissions-policy",
    failureRationale: "Permissions-Policy was missing, so sensitive browser features are not constrained.",
    id: "soc2-permissions-policy",
    passingRationale: "Permissions-Policy is configured.",
    severity: "low",
    title: "Browser permissions policy"
  },
  {
    control: "CC6.1",
    criterion: "CC6.1 — Logical access controls",
    description: "Authentication cookies must be Secure to prevent network interception.",
    failsOnFindingId: "cookie-missing-secure",
    failureRationale: "At least one cookie lacked the Secure flag.",
    id: "soc2-cookie-secure",
    passingRationale: "All observed cookies had the Secure flag.",
    severity: "medium",
    title: "Cookie Secure flag"
  },
  {
    control: "CC6.1",
    criterion: "CC6.1 — Logical access controls",
    description: "Session cookies should be HttpOnly to limit XSS impact.",
    failsOnFindingId: "cookie-missing-httponly",
    failureRationale: "At least one cookie lacked the HttpOnly flag.",
    id: "soc2-cookie-httponly",
    passingRationale: "All observed cookies had the HttpOnly flag.",
    severity: "low",
    title: "Cookie HttpOnly flag"
  },
  {
    control: "CC6.1",
    criterion: "CC6.1 — Logical access controls",
    description: "SameSite cookies reduce CSRF risk against authenticated workflows.",
    failsOnFindingId: "cookie-missing-samesite",
    failureRationale: "At least one cookie lacked a SameSite value.",
    id: "soc2-cookie-samesite",
    passingRationale: "All observed cookies declared a SameSite value.",
    severity: "low",
    title: "Cookie SameSite directive"
  },
  {
    control: "CC2.3",
    criterion: "CC2.3 — Communicates information to internal and external users",
    description: "Public information must be accessible per WCAG and language tagging.",
    failsOnFindingId: "missing-document-language",
    failureRationale: "The HTML root lacked a lang attribute.",
    id: "soc2-language",
    passingRationale: "The HTML root declared a lang attribute.",
    severity: "low",
    title: "Accessible content (language)"
  },
  {
    control: "CC2.3",
    criterion: "CC2.3 — Communicates information",
    description: "Forms used for sign-up or contact should expose accessible labels.",
    failsOnFindingId: "form-labels-missing",
    failureRationale: "A form with visible controls had no accessible labels.",
    id: "soc2-form-labels",
    passingRationale: "Observed forms exposed accessible labels.",
    severity: "low",
    title: "Accessible form controls"
  }
];

export function generateSoc2Checklist(findings: ScanFinding[]): Soc2Checklist {
  const failedIds = new Set(findings.map((finding) => finding.id));
  const items: Soc2ChecklistItem[] = rules.map((rule) => {
    const failed = failedIds.has(rule.failsOnFindingId);
    return {
      control: rule.control,
      criterion: rule.criterion,
      description: rule.description,
      evidence: failed
        ? `Detected finding ${rule.failsOnFindingId}.`
        : "No matching passive finding was detected.",
      id: rule.id,
      passing: !failed,
      rationale: failed ? rule.failureRationale : rule.passingRationale,
      severity: rule.severity,
      title: rule.title
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    items,
    passed: items.filter((item) => item.passing).length,
    total: items.length
  };
}
