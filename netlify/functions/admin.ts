import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { findPersonalWorkspaceId, requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import { tierFromString, type Tier } from "./_lib/tiers";

type AdminAction =
  | { action: "list-users" }
  | { action: "get-user"; userId: string }
  | { action: "assign-plan"; userId: string; tier: Tier | null }
  | { action: "stats" };

async function requireAdmin(event: NetlifyEvent) {
  const client = serverSupabaseClient();
  const { response, user } = await requireAuthenticatedUser(event, client);
  if (response) {
    return { errorResponse: response, client };
  }

  const { data: profile } = await client.from("profiles").select("is_admin").eq("id", user!.id).maybeSingle();
  if (!profile?.is_admin) {
    return { errorResponse: errorResponse("Forbidden.", 403), client };
  }

  return { user, client };
}

async function listUsers(client: ReturnType<typeof serverSupabaseClient>) {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, email, full_name, is_admin, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to list users.");
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const userIds = profiles.map((p) => p.id);

  const [{ data: subs }, { data: domainCounts }, { data: scanCounts }] = await Promise.all([
    client
      .from("subscriptions")
      .select("user_id, id, tier, status, manual_override, current_period_end")
      .in("user_id", userIds)
      .order("updated_at", { ascending: false }),
    client
      .from("domains")
      .select("user_id, id")
      .in("user_id", userIds),
    client
      .from("scan_runs")
      .select("user_id, id")
      .in("user_id", userIds)
  ]);

  const subsByUser: Record<string, (typeof subs)[0]> = {};
  for (const sub of subs ?? []) {
    if (!subsByUser[sub.user_id]) {
      subsByUser[sub.user_id] = sub;
    }
  }

  const domainCountByUser: Record<string, number> = {};
  for (const domain of domainCounts ?? []) {
    domainCountByUser[domain.user_id] = (domainCountByUser[domain.user_id] ?? 0) + 1;
  }

  const scanCountByUser: Record<string, number> = {};
  for (const run of scanCounts ?? []) {
    scanCountByUser[run.user_id] = (scanCountByUser[run.user_id] ?? 0) + 1;
  }

  return profiles.map((profile) => ({
    created_at: profile.created_at,
    domains: domainCountByUser[profile.id] ?? 0,
    email: profile.email,
    full_name: profile.full_name,
    id: profile.id,
    is_admin: profile.is_admin,
    scans: scanCountByUser[profile.id] ?? 0,
    subscription: subsByUser[profile.id] ?? null
  }));
}

async function getUserDetail(client: ReturnType<typeof serverSupabaseClient>, userId: string) {
  const [{ data: profile }, { data: subscriptions }, { data: domains }, { data: scans }] = await Promise.all([
    client.from("profiles").select("id, email, full_name, is_admin, created_at").eq("id", userId).maybeSingle(),
    client
      .from("subscriptions")
      .select("id, tier, status, manual_override, billing_interval, current_period_start, current_period_end, stripe_subscription_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    client
      .from("domains")
      .select("id, hostname, verification_status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("scan_runs")
      .select("id, scan_type, created_at, domain_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (!profile) {
    return null;
  }

  return { domains: domains ?? [], profile, scans: scans ?? [], subscriptions: subscriptions ?? [] };
}

async function assignPlan(client: ReturnType<typeof serverSupabaseClient>, userId: string, tier: Tier | null) {
  const { data: authUser } = await client.auth.admin.getUserById(userId);
  if (!authUser?.user) {
    throw new Error("User not found.");
  }

  if (tier === null) {
    const { error } = await client
      .from("subscriptions")
      .update({ status: "inactive", manual_override: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("manual_override", true);

    if (error) {
      throw new Error("Failed to revoke plan.");
    }

    return { tier: null };
  }

  const workspaceId = await findPersonalWorkspaceId(client, authUser.user);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const { data: existing } = await client
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("manual_override", true)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("subscriptions")
      .update({
        billing_interval: "annual",
        current_period_end: periodEnd.toISOString(),
        current_period_start: periodStart.toISOString(),
        status: "active",
        tier,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error("Failed to update plan.");
    }
  } else {
    const { error } = await client.from("subscriptions").insert({
      billing_interval: "annual",
      current_period_end: periodEnd.toISOString(),
      current_period_start: periodStart.toISOString(),
      manual_override: true,
      status: "active",
      tier,
      user_id: userId,
      workspace_id: workspaceId
    });

    if (error) {
      throw new Error("Failed to create plan.");
    }
  }

  return { tier };
}

async function getStats(client: ReturnType<typeof serverSupabaseClient>) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: totalUsers }, { count: payingUsers }, { count: scansToday }] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }),
    client
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    client
      .from("scan_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
  ]);

  return {
    paying_users: payingUsers ?? 0,
    scans_today: scansToday ?? 0,
    total_users: totalUsers ?? 0
  };
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const { errorResponse: authError, client } = await requireAdmin(event);
  if (authError || !client) {
    return authError ?? errorResponse("Internal error.", 500);
  }

  const body = parseJsonBody<AdminAction>(event);
  if (!body?.action) {
    return errorResponse("Missing action.", 400);
  }

  try {
    switch (body.action) {
      case "stats": {
        const stats = await getStats(client);
        return jsonResponse(stats);
      }

      case "list-users": {
        const users = await listUsers(client);
        return jsonResponse({ users });
      }

      case "get-user": {
        if (!body.userId) {
          return errorResponse("Missing userId.", 400);
        }

        const detail = await getUserDetail(client, body.userId);
        if (!detail) {
          return errorResponse("User not found.", 404);
        }

        return jsonResponse(detail);
      }

      case "assign-plan": {
        if (!body.userId) {
          return errorResponse("Missing userId.", 400);
        }

        const tier = tierFromString(body.tier);
        if (body.tier !== null && !tier) {
          return errorResponse("Invalid tier.", 400);
        }

        const result = await assignPlan(client, body.userId, tier);
        return jsonResponse(result);
      }

      default:
        return errorResponse("Unknown action.", 400);
    }
  } catch (err) {
    console.error("admin function error:", err);
    return errorResponse("Internal server error.", 500);
  }
}
