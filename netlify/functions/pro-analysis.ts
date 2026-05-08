import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { AnthropicSetupError, generateProAnalysis } from "./_lib/anthropic";
import { validateTargetUrl } from "./_lib/network";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { calculateRiskScore, persistReport } from "./_lib/reports";
import { analyzePassive, fetchWithGuards, type ScanFinding } from "./_lib/scan-engine";
import { generateSoc2Checklist } from "./_lib/soc2";
import { findPersonalWorkspaceId, requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import { attachReportToScanRun, isActiveSubscription, releaseScanSlot, reserveScanSlot } from "./_lib/quota";
import { tierConfig } from "./_lib/tiers";

export type ProAnalysisMode = "guided-ai-review" | "controlled-live-inspection";

type ProAnalysisRequest = {
  context?: string;
  domainId?: string;
  mode?: ProAnalysisMode;
  url?: string;
};

const proAnalysisRateLimit = {
  perIpPerHour: 12,
  windowSeconds: 3600
};

// Headers we send to the AI as evidence. Keep this tight: only headers that
// inform launch-readiness review, never anything that could carry a secret
// (set-cookie, authorization, custom auth headers, debug ids).
const aiSafeHeaderNames = new Set([
  "content-type",
  "content-language",
  "content-encoding",
  "server",
  "via",
  "x-content-type-options",
  "x-frame-options",
  "x-xss-protection",
  "strict-transport-security",
  "content-security-policy",
  "content-security-policy-report-only",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "cross-origin-embedder-policy",
  "report-to",
  "reporting-endpoints",
  "expect-ct",
  "cache-control"
]);

function aiSafeHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!aiSafeHeaderNames.has(key.toLowerCase())) {
      continue;
    }

    safe[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }

  return safe;
}

function sameDomainLinks(html: string, baseUrl: URL): URL[] {
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map((match) => {
      try {
        return new URL(match[1], baseUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => url.protocol === baseUrl.protocol && url.hostname === baseUrl.hostname)
    .slice(0, 3);

  return Array.from(new Map(links.map((url) => [url.toString(), url])).values());
}

function formSummary(html: string) {
  return {
    formCount: (html.match(/<form\b/gi) ?? []).length,
    hasLabels: /<label\b/i.test(html),
    passwordFieldCount: (html.match(/<input\b[^>]*\btype\s*=\s*["']password["'][^>]*>/gi) ?? []).length
  };
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const request = parseJsonBody<ProAnalysisRequest>(event);
  if (!request) {
    return errorResponse("Invalid JSON body.", 400);
  }

  if (request.mode !== "guided-ai-review" && request.mode !== "controlled-live-inspection") {
    return errorResponse("Choose Guided AI Review or Controlled Live Inspection.", 400);
  }

  if (!request.domainId) {
    return errorResponse("domainId is required.", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = validateTargetUrl(request.url);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid URL.", 400);
  }

  const authResult = await requireAuthenticatedUser(event);
  if (authResult.response) {
    return authResult.response;
  }

  const client = serverSupabaseClient();
  const ip = clientIpAddress(event);

  const rateLimit = await consumeRateLimit(client, {
    bucket: `ip:${ip}:pro-analysis`,
    limit: proAnalysisRateLimit.perIpPerHour,
    windowSeconds: proAnalysisRateLimit.windowSeconds
  });
  if (!rateLimit.allowed) {
    return errorResponse("Rate limit exceeded. Try again later.", 429);
  }

  const { data: domainRow, error: domainError } = await client
    .from("domains")
    .select("id,user_id,workspace_id,subscription_id,hostname,verification_status")
    .eq("id", request.domainId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (domainError) {
    return errorResponse("Domain lookup failed.", 500);
  }

  if (!domainRow) {
    return errorResponse("Domain was not found for this account.", 404);
  }

  if (domainRow.verification_status !== "verified") {
    return errorResponse("Verify domain ownership before AI analysis.", 403);
  }

  if (targetUrl.hostname.toLowerCase() !== (domainRow.hostname as string).toLowerCase()) {
    return errorResponse("URL hostname must match the verified domain.", 400);
  }

  if (!domainRow.subscription_id) {
    return errorResponse("This domain has no active subscription.", 402);
  }

  const { data: subscription, error: subscriptionError } = await client
    .from("subscriptions")
    .select("id,user_id,workspace_id,tier,status,current_period_start,current_period_end")
    .eq("id", domainRow.subscription_id)
    .maybeSingle();

  if (subscriptionError) {
    return errorResponse("Subscription lookup failed.", 500);
  }

  if (!subscription || !isActiveSubscription(subscription)) {
    return errorResponse("Activate the subscription before AI analysis.", 402);
  }

  if (!tierConfig[subscription.tier as keyof typeof tierConfig]?.aiEnabled) {
    return errorResponse("AI analysis requires the Pro or Enterprise tier.", 402);
  }

  const workspaceId = await findPersonalWorkspaceId(client, {
    email: authResult.user.email,
    id: authResult.user.id
  });

  const reservation = await reserveScanSlot(client, {
    domainId: domainRow.id as string,
    ipAddress: ip === "unknown" ? null : ip,
    scanType: request.mode,
    subscription,
    userId: authResult.user.id,
    workspaceId
  });

  if (!reservation.allowed) {
    return errorResponse(
      `Run quota exhausted (${reservation.used}/${reservation.limit} for this billing period).`,
      429
    );
  }

  try {
    let homePage: Awaited<ReturnType<typeof fetchWithGuards>>;
    try {
      homePage = await fetchWithGuards(targetUrl);
    } catch (fetchError) {
      await releaseScanSlot(client, reservation.runId);
      if (fetchError instanceof Error && /public URL|Redirect target|Too many redirects|location|http or https/i.test(fetchError.message)) {
        return errorResponse(fetchError.message, 400);
      }

      return errorResponse("Unable to fetch site.", 502);
    }

    if (new URL(homePage.finalUrl).hostname.toLowerCase() !== (domainRow.hostname as string).toLowerCase()) {
      await releaseScanSlot(client, reservation.runId);
      return errorResponse("Analysis stopped because a redirect left the verified domain.", 400);
    }

    const passiveReport = analyzePassive({
      finalUrl: homePage.finalUrl,
      headers: homePage.headers,
      html: homePage.body,
      htmlTruncated: homePage.htmlTruncated,
      initialUrl: targetUrl.toString(),
      status: homePage.status
    });

    const soc2 = generateSoc2Checklist(passiveReport.findings);

    const linkedPages: Array<{
      error?: string;
      form?: ReturnType<typeof formSummary>;
      headers?: Record<string, string>;
      status?: number;
      url: string;
    }> = [];
    if (request.mode === "controlled-live-inspection") {
      for (const link of sameDomainLinks(homePage.body, new URL(homePage.finalUrl))) {
        try {
          const child = await fetchWithGuards(link);
          if (new URL(child.finalUrl).hostname.toLowerCase() !== (domainRow.hostname as string).toLowerCase()) {
            linkedPages.push({ error: "Redirect left the verified domain.", url: link.toString() });
            continue;
          }
          linkedPages.push({
            form: formSummary(child.body),
            headers: aiSafeHeaders(child.headers),
            status: child.status,
            url: child.finalUrl
          });
        } catch (linkError) {
          linkedPages.push({
            error: linkError instanceof Error ? linkError.message : "Request failed.",
            url: link.toString()
          });
        }
      }
    }

    const evidence = {
      home: {
        finalUrl: homePage.finalUrl,
        form: formSummary(homePage.body),
        headers: aiSafeHeaders(homePage.headers),
        passiveFindings: passiveReport.findings,
        soc2,
        status: homePage.status
      },
      linkedPages,
      type: request.mode
    };

    let aiFindings: ScanFinding[] = [];
    let aiSummary: string;
    try {
      const analysis = await generateProAnalysis({
        context: request.context?.slice(0, 2000),
        evidence,
        mode: request.mode,
        url: targetUrl.toString()
      });
      aiFindings = analysis.findings.map((finding) => ({
        category: request.mode === "controlled-live-inspection" ? "controlled-inspection" : "ai-review",
        description: finding.description,
        evidence: finding.evidence,
        id: finding.id,
        remediation: finding.remediation,
        severity: finding.severity,
        title: finding.title
      }));
      aiSummary = analysis.summary;
    } catch (aiError) {
      await releaseScanSlot(client, reservation.runId);
      if (aiError instanceof AnthropicSetupError) {
        return errorResponse(aiError.message, 503);
      }

      console.error("pro-analysis: AI request failed", aiError);
      return errorResponse("AI analysis failed. Please try again.", 500);
    }

    const combinedFindings: ScanFinding[] = [...aiFindings, ...passiveReport.findings];
    const riskScore = calculateRiskScore(combinedFindings);

    const persisted = await persistReport(client, {
      domainId: domainRow.id as string,
      findings: combinedFindings,
      payload: {
        aiSummary,
        finalUrl: homePage.finalUrl,
        generatedAt: new Date().toISOString(),
        mode: request.mode,
        passiveFindings: passiveReport.findings,
        passiveSummary: passiveReport.summary,
        soc2,
        status: homePage.status
      },
      riskScore,
      scanType: request.mode,
      subscriptionId: subscription.id,
      summary: aiSummary,
      targetUrl: homePage.finalUrl,
      userId: authResult.user.id,
      workspaceId
    });

    await attachReportToScanRun(client, reservation.runId, persisted.id);

    return jsonResponse({
      aiFindings,
      finalUrl: homePage.finalUrl,
      findings: combinedFindings,
      generatedAt: new Date().toISOString(),
      mode: request.mode,
      passiveFindings: passiveReport.findings,
      quota: {
        limit: reservation.limit,
        remaining: Math.max(0, reservation.limit - reservation.used),
        used: reservation.used
      },
      reportId: persisted.id,
      riskScore,
      soc2,
      summary: aiSummary,
      url: homePage.finalUrl
    });
  } catch (error) {
    await releaseScanSlot(client, reservation.runId);
    console.error("pro-analysis failed", error);
    return errorResponse("AI analysis failed.", 500);
  }
}
