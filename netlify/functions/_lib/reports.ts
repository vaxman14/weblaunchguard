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

const severityScore = { high: 24, low: 5, medium: 12 } as const;

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

