import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { validateTargetUrl } from "./_lib/network";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { calculateRiskScore } from "./_lib/reports";
import { analyzePassive, fetchWithGuards, type ScanFinding } from "./_lib/scan-engine";
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

  const rateLimit = await consumeRateLimit(client, {
    bucket: `ip:${ip}:demo-scan`,
    limit: 5,
    windowSeconds: 3600
  });
  if (!rateLimit.allowed) {
    return errorResponse("Demo rate limit reached. Sign up for unlimited access.", 429);
  }

  let response: Awaited<ReturnType<typeof fetchWithGuards>>;
  try {
    response = await fetchWithGuards(targetUrl);
  } catch (err) {
    if (err instanceof Error && /public URL|Redirect target|Too many redirects|location|http or https/i.test(err.message)) {
      return errorResponse(err.message, 400);
    }
    return errorResponse("Unable to fetch site.", 502);
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
