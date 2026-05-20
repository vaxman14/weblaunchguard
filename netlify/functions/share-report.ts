import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";

type ShareAction =
  | { action: "create"; reportId: string }
  | { action: "revoke"; reportId: string };

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;

  const client = serverSupabaseClient();
  const { response, user } = await requireAuthenticatedUser(event, client);
  if (response) return response;

  const body = parseJsonBody<ShareAction>(event);
  if (!body?.action || !body.reportId) return errorResponse("Missing action or reportId.", 400);

  const { data: report } = await client
    .from("reports")
    .select("id, share_token")
    .eq("id", body.reportId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!report) return errorResponse("Report not found.", 404);

  if (body.action === "create") {
    const { data, error } = await client
      .from("reports")
      .update({ share_token: crypto.randomUUID() })
      .eq("id", body.reportId)
      .select("share_token")
      .single();
    if (error) return errorResponse("Failed to create share link.", 500);
    return jsonResponse({ share_token: data.share_token });
  }

  if (body.action === "revoke") {
    const { error } = await client
      .from("reports")
      .update({ share_token: null })
      .eq("id", body.reportId);
    if (error) return errorResponse("Failed to revoke share link.", 500);
    return jsonResponse({ ok: true });
  }

  return errorResponse("Unknown action.", 400);
}
