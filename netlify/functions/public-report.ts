import { errorResponse, jsonResponse, requireMethod, type NetlifyEvent } from "./_lib/http";
import { serverSupabaseClient } from "./_lib/supabase";

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "GET");
  if (methodError) return methodError;

  const shareToken = event.queryStringParameters?.token;
  if (!shareToken) return errorResponse("Missing token.", 400);

  const client = serverSupabaseClient();

  const { data: report } = await client
    .from("reports")
    .select("id, target_url, scan_type, summary, score, domain_id, payload, created_at")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (!report) return errorResponse("Report not found.", 404);

  const [{ data: findings }, { data: domain }] = await Promise.all([
    client
      .from("findings")
      .select("id, category, description, evidence, remediation, severity, title")
      .eq("report_id", report.id)
      .order("created_at", { ascending: true }),
    client
      .from("domains")
      .select("hostname")
      .eq("id", report.domain_id)
      .maybeSingle()
  ]);

  return jsonResponse({
    domain: domain ?? null,
    findings: findings ?? [],
    report
  });
}
