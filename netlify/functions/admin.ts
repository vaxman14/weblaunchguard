import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { findPersonalWorkspaceId, requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import { tierFromString, type Tier } from "./_lib/tiers";

type AdminAction =
  | { action: "list-users" }
  | { action: "get-user"; userId: string }
  | { action: "assign-plan"; userId: string; tier: Tier | null }
  | { action: "assign-client"; userId: string; clientId: string | null }
  | { action: "list-clients" }
  | { action: "create-client"; name: string; contactEmail?: string; notes?: string }
  | { action: "update-client"; clientId: string; name?: string; contactEmail?: string; notes?: string }
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

  return { client };
}

async function listClients(client: ReturnType<typeof serverSupabaseClient>) {
  const { data: clients, error } = await client
    .from("clients")
    .select("id, name, contact_email, notes, created_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to list clients.");
  }

  if (!clients || clients.length === 0) {
    return [];
  }

  const clientIds = clients.map((c) => c.id);
  const { data: members } = await client
    .from("profiles")
    .select("client_id, id")
    .in("client_id", clientIds);

  const memberCountByClient: Record<string, number> = {};
  for (const m of members ?? []) {
    if (m.client_id) {
      memberCountByClient[m.client_id] = (memberCountByClient[m.client_id] ?? 0) + 1;
    }
  }

  return clients.map((c) => ({ ...c, user_count: memberCountByClient[c.id] ?? 0 }));
}

async function listUsers(client: ReturnType<typeof serverSupabaseClient>) {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, email, full_name, is_admin, client_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to list users.");
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  const userIds = profiles.map((p) => p.id);
  const clientIds = [...new Set(profiles.map((p) => p.client_id).filter(Boolean))] as string[];

  const [{ data: subs }, { data: domainCounts }, { data: scanCounts }, { data: clientRows }] = await Promise.all([
    client
      .from("subscriptions")
      .select("user_id, id, tier, status, manual_override, current_period_end")
      .in("user_id", userIds)
      .order("updated_at", { ascending: false }),
    client.from("domains").select("user_id, id").in("user_id", userIds),
    client.from("scan_runs").select("user_id, id").in("user_id", userIds),
    clientIds.length > 0
      ? client.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] })
  ]);

  const subsByUser: Record<string, (typeof subs)[0]> = {};
  for (const sub of subs ?? []) {
    if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = sub;
  }

  const domainCountByUser: Record<string, number> = {};
  for (const d of domainCounts ?? []) {
    domainCountByUser[d.user_id] = (domainCountByUser[d.user_id] ?? 0) + 1;
  }

  const scanCountByUser: Record<string, number> = {};
  for (const r of scanCounts ?? []) {
    scanCountByUser[r.user_id] = (scanCountByUser[r.user_id] ?? 0) + 1;
  }

  const clientNamesById: Record<string, string> = {};
  for (const c of clientRows ?? []) {
    clientNamesById[c.id] = c.name;
  }

  return profiles.map((p) => ({
    client_id: p.client_id ?? null,
    client_name: p.client_id ? (clientNamesById[p.client_id] ?? null) : null,
    created_at: p.created_at,
    domains: domainCountByUser[p.id] ?? 0,
    email: p.email,
    full_name: p.full_name,
    id: p.id,
    is_admin: p.is_admin,
    scans: scanCountByUser[p.id] ?? 0,
    subscription: subsByUser[p.id] ?? null
  }));
}

async function getUserDetail(client: ReturnType<typeof serverSupabaseClient>, userId: string) {
  const [{ data: profile }, { data: subscriptions }, { data: domains }, { data: scans }] = await Promise.all([
    client
      .from("profiles")
      .select("id, email, full_name, is_admin, client_id, created_at")
      .eq("id", userId)
      .maybeSingle(),
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

  if (!profile) return null;

  let clientName: string | null = null;
  if (profile.client_id) {
    const { data: clientRow } = await client
      .from("clients")
      .select("name")
      .eq("id", profile.client_id)
      .maybeSingle();
    clientName = clientRow?.name ?? null;
  }

  return {
    domains: domains ?? [],
    profile: { ...profile, client_name: clientName },
    scans: scans ?? [],
    subscriptions: subscriptions ?? []
  };
}

async function assignPlan(client: ReturnType<typeof serverSupabaseClient>, userId: string, tier: Tier | null) {
  const { data: authUser } = await client.auth.admin.getUserById(userId);
  if (!authUser?.user) throw new Error("User not found.");

  if (tier === null) {
    const { error } = await client
      .from("subscriptions")
      .update({ status: "inactive", manual_override: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("manual_override", true);
    if (error) throw new Error("Failed to revoke plan.");
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
    if (error) throw new Error("Failed to update plan.");
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
    if (error) throw new Error("Failed to create plan.");
  }

  return { tier };
}

async function getStats(client: ReturnType<typeof serverSupabaseClient>) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: totalUsers }, { count: payingUsers }, { count: scansToday }, { count: totalClients }] =
    await Promise.all([
      client.from("profiles").select("id", { count: "exact", head: true }),
      client.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      client
        .from("scan_runs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
      client.from("clients").select("id", { count: "exact", head: true })
    ]);

  return {
    paying_users: payingUsers ?? 0,
    scans_today: scansToday ?? 0,
    total_clients: totalClients ?? 0,
    total_users: totalUsers ?? 0
  };
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;

  const { errorResponse: authError, client } = await requireAdmin(event);
  if (authError || !client) return authError ?? errorResponse("Internal error.", 500);

  const body = parseJsonBody<AdminAction>(event);
  if (!body?.action) return errorResponse("Missing action.", 400);

  try {
    switch (body.action) {
      case "stats":
        return jsonResponse(await getStats(client));

      case "list-users":
        return jsonResponse({ users: await listUsers(client) });

      case "list-clients":
        return jsonResponse({ clients: await listClients(client) });

      case "create-client": {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return errorResponse("Client name is required.", 400);
        const { data, error } = await client
          .from("clients")
          .insert({
            contact_email: typeof body.contactEmail === "string" ? body.contactEmail.trim() : null,
            name,
            notes: typeof body.notes === "string" ? body.notes.trim() : null
          })
          .select("id, name, contact_email, notes, created_at")
          .single();
        if (error) throw new Error("Failed to create client.");
        return jsonResponse(data);
      }

      case "update-client": {
        if (!body.clientId) return errorResponse("Missing clientId.", 400);
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.name === "string") updates.name = body.name.trim();
        if (typeof body.contactEmail === "string") updates.contact_email = body.contactEmail.trim() || null;
        if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
        const { error } = await client.from("clients").update(updates).eq("id", body.clientId);
        if (error) throw new Error("Failed to update client.");
        return jsonResponse({ ok: true });
      }

      case "assign-client": {
        if (!body.userId) return errorResponse("Missing userId.", 400);
        const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
        const { error } = await client
          .from("profiles")
          .update({ client_id: clientId, updated_at: new Date().toISOString() })
          .eq("id", body.userId);
        if (error) throw new Error("Failed to assign client.");
        return jsonResponse({ ok: true });
      }

      case "get-user": {
        if (!body.userId) return errorResponse("Missing userId.", 400);
        const detail = await getUserDetail(client, body.userId);
        if (!detail) return errorResponse("User not found.", 404);
        return jsonResponse(detail);
      }

      case "assign-plan": {
        if (!body.userId) return errorResponse("Missing userId.", 400);
        const tier = tierFromString(body.tier);
        if (body.tier !== null && !tier) return errorResponse("Invalid tier.", 400);
        return jsonResponse(await assignPlan(client, body.userId, tier));
      }

      default:
        return errorResponse("Unknown action.", 400);
    }
  } catch (err) {
    console.error("admin function error:", err);
    return errorResponse("Internal server error.", 500);
  }
}
