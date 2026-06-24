import type { ServerSupabaseClient } from "./supabase";
import type { ScanFinding } from "./scan-engine";

export type ScanType = "passive" | "guided-ai-review" | "controlled-live-inspection";

export type PersistedReport = {
  domainId: string;
  findings: ScanFinding[];
  payload: Record<string, unknown>;
  riskScore: number;
  scanType: ScanType;
  subscriptionId: string;
  summary: string;
  targetUrl: string;
  userId: string;
  workspaceId: string;
};

// Start at 100; each issue deducts by severity. Tuned so the broad check set
// spreads sites across a meaningful range (clean ~90-100, typical small-biz
// ~45-70, rough sites ~15-40) instead of flooring everything at 0. The score
// explainer modal documents these weights for users.
const severityScore = { high: 10, low: 2, medium: 5 } as const;

export function calculateRiskScore(findings: ScanFinding[]): number {
  const total = findings.reduce((acc, finding) => acc + severityScore[finding.severity], 0);
  return Math.max(0, Math.min(100, 100 - total));
}

export async function persistReport(client: ServerSupabaseClient, report: PersistedReport): Promise<{ id: string }> {
  const { data: row, error } = await client
    .from("reports")
    .insert({
      domain_id: report.domainId,
      payload: report.payload,
      score: report.riskScore,
      scan_type: report.scanType,
      status: "ready",
      subscription_id: report.subscriptionId,
      summary: report.summary,
      target_url: report.targetUrl,
      user_id: report.userId,
      workspace_id: report.workspaceId
    })
    .select("id")
    .single();

  if (error || !row) {
    throw new Error("Report could not be saved.");
  }

  if (report.findings.length > 0) {
    const findingsRows = report.findings.slice(0, 100).map((finding) => ({
      category: finding.category,
      description: finding.description ?? null,
      evidence: finding.evidence ? { note: finding.evidence } : {},
      remediation: finding.remediation ?? null,
      report_id: row.id,
      severity: finding.severity === "high" ? "high" : finding.severity === "medium" ? "medium" : "low",
      title: finding.title
    }));

    const { error: findingsError } = await client.from("findings").insert(findingsRows);
    if (findingsError) {
      // Best-effort: don't block report return on findings persistence.
      // The payload column still has the full evidence.
    }
  }

  return { id: row.id as string };
}

