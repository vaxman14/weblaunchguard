export type FindingSeverity = "low" | "medium" | "high";
export type Tier = "basic" | "pro" | "enterprise";
export type BillingInterval = "monthly" | "annual";
export type ScanType = "passive" | "guided-ai-review" | "controlled-live-inspection";

export type ScanFinding = {
  category: string;
  description: string;
  evidence?: string;
  id: string;
  remediation?: string;
  severity: FindingSeverity;
  title: string;
};

export type Soc2ChecklistItem = {
  control: string;
  criterion: string;
  description: string;
  evidence: string;
  id: string;
  passing: boolean;
  rationale: string;
  severity: FindingSeverity;
  title: string;
};

export type Soc2Checklist = {
  generatedAt: string;
  items: Soc2ChecklistItem[];
  passed: number;
  total: number;
};

export type ScanQuota = {
  limit: number;
  remaining: number;
  used: number;
};

export type PassiveScanResponse = {
  findings: ScanFinding[];
  finalUrl: string;
  generatedAt: string;
  htmlTruncated: boolean;
  initialUrl: string;
  quota: ScanQuota;
  reportId: string;
  riskScore: number;
  soc2: Soc2Checklist;
  status: number;
  summary: string;
};

export type ProAnalysisMode = "guided-ai-review" | "controlled-live-inspection";

export type ProAnalysisResponse = {
  aiFindings: ScanFinding[];
  finalUrl: string;
  findings: ScanFinding[];
  generatedAt: string;
  mode: ProAnalysisMode;
  passiveFindings: ScanFinding[];
  quota: ScanQuota;
  reportId: string;
  riskScore: number;
  soc2: Soc2Checklist;
  summary: string;
  url: string;
};

export type DomainRow = {
  hostname: string;
  id: string;
  subscription_id: string | null;
  verification_status: "pending" | "verified" | "failed";
  verification_token: string | null;
  verified_at?: string | null;
};

export type CreateDomainResponse = {
  domain: DomainRow;
};

export type DomainVerificationResponse = {
  checkedHostnames: string[];
  expectedValue: string;
  hostname: string;
  verified: boolean;
};

type AuthRequest = { accessToken?: string | null };

function authHeaders(accessToken?: string | null): Record<string, string> {
  return {
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    "content-type": "application/json"
  };
}

async function readJson<T>(response: Response, fallbackError: string): Promise<T> {
  const body = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    throw new Error(message || fallbackError);
  }

  return body as T;
}

export async function runPassiveScan(input: AuthRequest & { domainId: string; url: string }): Promise<PassiveScanResponse> {
  const response = await fetch("/.netlify/functions/passive-scan", {
    body: JSON.stringify({ domainId: input.domainId, url: input.url }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<PassiveScanResponse>(response, "Passive scan failed.");
}

export async function runProAnalysis(input: AuthRequest & {
  context?: string;
  domainId: string;
  mode: ProAnalysisMode;
  url: string;
}): Promise<ProAnalysisResponse> {
  const response = await fetch("/.netlify/functions/pro-analysis", {
    body: JSON.stringify({
      context: input.context,
      domainId: input.domainId,
      mode: input.mode,
      url: input.url
    }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<ProAnalysisResponse>(response, "AI analysis failed.");
}

export async function createDomain(input: AuthRequest & { hostname: string; subscriptionId: string }): Promise<CreateDomainResponse> {
  const response = await fetch("/.netlify/functions/domains", {
    body: JSON.stringify({
      action: "create",
      hostname: input.hostname,
      subscriptionId: input.subscriptionId
    }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<CreateDomainResponse>(response, "Domain creation failed.");
}

export async function deleteDomain(input: AuthRequest & { domainId: string }): Promise<{ removed: boolean }> {
  const response = await fetch("/.netlify/functions/domains", {
    body: JSON.stringify({ action: "delete", domainId: input.domainId }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<{ removed: boolean }>(response, "Domain deletion failed.");
}

export async function verifyDomain(input: AuthRequest & { domainId: string }): Promise<DomainVerificationResponse> {
  const response = await fetch("/.netlify/functions/verify-domain", {
    body: JSON.stringify({ domainId: input.domainId }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<DomainVerificationResponse>(response, "Domain verification failed.");
}

export async function createCheckoutSession(input: AuthRequest & {
  interval: BillingInterval;
  tier: Tier;
}): Promise<{ url: string }> {
  const response = await fetch("/.netlify/functions/create-checkout", {
    body: JSON.stringify({ interval: input.interval, tier: input.tier }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<{ url: string }>(response, "Checkout session creation failed.");
}

export async function createPortalSession(input: AuthRequest): Promise<{ url: string }> {
  const response = await fetch("/.netlify/functions/create-portal", {
    body: JSON.stringify({}),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<{ url: string }>(response, "Customer Portal session creation failed.");
}

export type DemoScanResponse = {
  findings: ScanFinding[];
  finalUrl: string;
  generatedAt: string;
  riskScore: number;
  summary: string;
  totalFindings: number;
};

export async function runDemoScan(url: string): Promise<DemoScanResponse> {
  const response = await fetch("/.netlify/functions/demo-scan", {
    body: JSON.stringify({ url }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  return readJson<DemoScanResponse>(response, "Demo scan failed.");
}

export async function createShareToken(input: AuthRequest & { reportId: string }): Promise<{ share_token: string }> {
  const response = await fetch("/.netlify/functions/share-report", {
    body: JSON.stringify({ action: "create", reportId: input.reportId }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<{ share_token: string }>(response, "Failed to create share link.");
}

export async function revokeShareToken(input: AuthRequest & { reportId: string }): Promise<{ ok: boolean }> {
  const response = await fetch("/.netlify/functions/share-report", {
    body: JSON.stringify({ action: "revoke", reportId: input.reportId }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  return readJson<{ ok: boolean }>(response, "Failed to revoke share link.");
}

export type PublicReportResponse = {
  domain: { hostname: string } | null;
  findings: Array<{
    category: string | null;
    description: string | null;
    evidence: { note?: string } | null;
    id: string;
    remediation: string | null;
    severity: "low" | "medium" | "high" | null;
    title: string;
  }>;
  report: {
    created_at: string;
    domain_id: string;
    id: string;
    payload: { soc2?: Soc2Checklist } | null;
    scan_type: string | null;
    score: number | null;
    summary: string | null;
    target_url: string | null;
  };
};

export async function fetchPublicReport(shareToken: string): Promise<PublicReportResponse> {
  const response = await fetch(`/.netlify/functions/public-report?token=${encodeURIComponent(shareToken)}`, {
    method: "GET"
  });

  return readJson<PublicReportResponse>(response, "Report not found.");
}

export async function exportReportPdf(input: AuthRequest & { reportId: string }): Promise<Blob> {
  const response = await fetch("/.netlify/functions/export-report", {
    body: JSON.stringify({ reportId: input.reportId }),
    headers: authHeaders(input.accessToken),
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "PDF export failed.");
  }

  return response.blob();
}
