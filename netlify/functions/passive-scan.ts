import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { validateTargetUrl } from "./_lib/network";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { calculateRiskScore, persistReport } from "./_lib/reports";
import { analyzePassive, describeFetchError, fetchWithGuards } from "./_lib/scan-engine";
import { generateSoc2Checklist } from "./_lib/soc2";
import { findPersonalWorkspaceId, requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import { attachReportToScanRun, isActiveSubscription, releaseScanSlot, reserveScanSlot } from "./_lib/quota";

type PassiveScanRequest = {
  domainId?: string;
  url?: string;
};

const passiveScanRateLimit = {
  perIpPerHour: 30,
  windowSeconds: 3600
};

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const body = parseJsonBody<PassiveScanRequest>(event);
  if (!body) {
    return errorResponse("Invalid JSON body.", 400);
  }

  if (!body.domainId) {
    return errorResponse("domainId is required.", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = validateTargetUrl(body.url);
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
    bucket: `ip:${ip}:passive-scan`,
    limit: passiveScanRateLimit.perIpPerHour,
    windowSeconds: passiveScanRateLimit.windowSeconds
  });
  if (!rateLimit.allowed) {
    return errorResponse("Rate limit exceeded. Try again later.", 429);
  }

  const { data: domainRow, error: domainError } = await client
    .from("domains")
    .select("id,user_id,workspace_id,subscription_id,hostname,verification_status")
    .eq("id", body.domainId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (domainError) {
    return errorResponse("Domain lookup failed.", 500);
  }

  if (!domainRow) {
    return errorResponse("Domain was not found for this account.", 404);
  }

  if (domainRow.verification_status !== "verified") {
    return errorResponse("Verify domain ownership before scanning.", 403);
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
    return errorResponse("Activate the subscription before scanning.", 402);
  }

  const workspaceId = await findPersonalWorkspaceId(client, {
    email: authResult.user.email,
    id: authResult.user.id
  });

  const reservation = await reserveScanSlot(client, {
    domainId: domainRow.id as string,
    ipAddress: ip === "unknown" ? null : ip,
    scanType: "passive",
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
    let response: Awaited<ReturnType<typeof fetchWithGuards>>;
    try {
      response = await fetchWithGuards(targetUrl);
    } catch (error) {
      await releaseScanSlot(client, reservation.runId);
      const { message, status } = describeFetchError(error);
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

    const soc2 = generateSoc2Checklist(passiveReport.findings);
    const riskScore = calculateRiskScore(passiveReport.findings);

    const persisted = await persistReport(client, {
      domainId: domainRow.id as string,
      findings: passiveReport.findings,
      payload: {
        finalUrl: passiveReport.finalUrl,
        generatedAt: passiveReport.generatedAt,
        htmlTruncated: passiveReport.htmlTruncated,
        initialUrl: passiveReport.initialUrl,
        soc2,
        status: passiveReport.status,
        summary: passiveReport.summary
      },
      riskScore,
      scanType: "passive",
      subscriptionId: subscription.id,
      summary: passiveReport.summary,
      targetUrl: passiveReport.finalUrl,
      userId: authResult.user.id,
      workspaceId
    });

    await attachReportToScanRun(client, reservation.runId, persisted.id);

    return jsonResponse({
      findings: passiveReport.findings,
      finalUrl: passiveReport.finalUrl,
      generatedAt: passiveReport.generatedAt,
      htmlTruncated: passiveReport.htmlTruncated,
      initialUrl: passiveReport.initialUrl,
      quota: {
        limit: reservation.limit,
        remaining: Math.max(0, reservation.limit - reservation.used),
        used: reservation.used
      },
      reportId: persisted.id,
      riskScore,
      soc2,
      status: passiveReport.status,
      summary: passiveReport.summary
    });
  } catch (error) {
    await releaseScanSlot(client, reservation.runId);
    console.error("passive-scan failed", error);
    return errorResponse("Passive scan failed.", 500);
  }
}
