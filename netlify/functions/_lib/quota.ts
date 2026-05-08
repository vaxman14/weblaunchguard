import { tierConfig, type Tier } from "./tiers";
import type { ServerSupabaseClient } from "./supabase";
import type { ScanType } from "./reports";

export type SubscriptionRow = {
  current_period_end: string | null;
  current_period_start: string | null;
  id: string;
  status: string;
  tier: Tier;
  user_id: string;
  workspace_id: string;
};

const activeSubscriptionStatuses = new Set(["active", "trialing"]);

export function isActiveSubscription(subscription: Pick<SubscriptionRow, "status">): boolean {
  return activeSubscriptionStatuses.has(subscription.status);
}

export async function loadSubscription(
  client: ServerSupabaseClient,
  subscriptionId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select("id,user_id,workspace_id,tier,status,current_period_start,current_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error("Subscription lookup failed.");
  }

  return (data as SubscriptionRow | null) ?? null;
}

export type ReservationResult =
  | { allowed: true; limit: number; runId: string; used: number }
  | { allowed: false; limit: number; used: number };

// Atomic reservation: takes a transaction-scoped advisory lock on
// (subscription, domain) inside a SECURITY DEFINER function so two concurrent
// requests cannot both pass the quota check.
export async function reserveScanSlot(
  client: ServerSupabaseClient,
  params: {
    domainId: string;
    ipAddress: string | null;
    scanType: ScanType;
    subscription: SubscriptionRow;
    userId: string;
    workspaceId: string;
  }
): Promise<ReservationResult> {
  const config = tierConfig[params.subscription.tier];
  const periodStart = params.subscription.current_period_start ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client.rpc("reserve_scan_slot", {
    p_domain_id: params.domainId,
    p_ip: params.ipAddress,
    p_limit: config.runsPerDomainPerPeriod,
    p_period_start: periodStart,
    p_scan_type: params.scanType,
    p_subscription_id: params.subscription.id,
    p_user_id: params.userId,
    p_workspace_id: params.workspaceId
  });

  if (error) {
    throw new Error("Quota reservation failed.");
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    throw new Error("Quota reservation returned no row.");
  }

  if (!row.allowed) {
    return { allowed: false, limit: config.runsPerDomainPerPeriod, used: row.used ?? 0 };
  }

  return {
    allowed: true,
    limit: config.runsPerDomainPerPeriod,
    runId: row.run_id as string,
    used: row.used ?? 0
  };
}

export async function releaseScanSlot(client: ServerSupabaseClient, runId: string): Promise<void> {
  await client.from("scan_runs").delete().eq("id", runId);
}

export async function attachReportToScanRun(
  client: ServerSupabaseClient,
  runId: string,
  reportId: string
): Promise<void> {
  await client.from("scan_runs").update({ report_id: reportId }).eq("id", runId);
}
