import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { validateTargetUrl } from "./_lib/network";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { calculateRiskScore } from "./_lib/reports";
import { analyzePassive, describeFetchError, fetchWithGuards, type ScanFinding } from "./_lib/scan-engine";
import { serverSupabaseClient } from "./_lib/supabase";

type DemoScanRequest = {
  url?: string;
};

const MAX_DEMO_FINDINGS = 50;

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;

  const body = parseJsonBody<DemoScanRequest>(event);

  let targetUrl: URL;
  try {
    targetUrl = validateTargetUrl(body?.url);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Invalid URL.", 400);
  }

  const client = serverSupabaseClient();
  const ip = clientIpAddress(event);

  // Anonymous endpoint — brake per IP on both an hourly and a daily window so a
  // single caller can't use us as a free scanning proxy or run up our bandwidth.
  const hourly = await consumeRateLimit(client, {
    bucket: `ip:${ip}:demo-scan`,
    limit: 5,
    windowSeconds: 3600
  });
  if (!hourly.allowed) {
    return errorResponse("Demo rate limit reached. Create a free account to keep scanning.", 429);
  }

  const daily = await consumeRateLimit(client, {
    bucket: `ip:${ip}:demo-scan:day`,
    limit: 25,
    windowSeconds: 86400
  });
  if (!daily.allowed) {
    return errorResponse("Daily demo limit reached. Create a free account to keep scanning.", 429);
  }

  let response: Awaited<ReturnType<typeof fetchWithGuards>>;
  try {
    response = await fetchWithGuards(targetUrl);
  } catch (err) {
    const { message, status } = describeFetchError(err);
    return errorResponse(message, status);
  }

  const passiveReport = analyzePassive({
    finalUrl: response.finalUrl,
    headers: response.headers,
    html: response.body,
    htmlTruncated: response.htmlTruncated,
    initialUrl: targetUrl.toString(),
    status: response.status
  });

  const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...passiveReport.findings].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
  const demoFindings: ScanFinding[] = sorted.slice(0, MAX_DEMO_FINDINGS);
  const riskScore = calculateRiskScore(passiveReport.findings);

  return jsonResponse({
    findings: demoFindings,
    finalUrl: passiveReport.finalUrl,
    generatedAt: passiveReport.generatedAt,
    riskScore,
    summary: passiveReport.summary,
    totalFindings: passiveReport.findings.length
  });
}
