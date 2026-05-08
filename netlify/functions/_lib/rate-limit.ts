import type { ServerSupabaseClient } from "./supabase";
import type { NetlifyEvent } from "./http";

// Simple rolling-window rate limiter backed by a Postgres table. Best effort —
// not intended to stop a determined attacker, just to brake a misbehaving
// caller.

export type RateLimitConfig = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

export function clientIpAddress(event: NetlifyEvent): string {
  const headers = event.headers ?? {};
  const candidates = [
    headers["x-nf-client-connection-ip"],
    headers["x-real-ip"],
    headers["x-forwarded-for"]
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.split(",")[0]?.trim() || "unknown";
    }
  }

  return "unknown";
}

export async function consumeRateLimit(
  client: ServerSupabaseClient,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const sinceIso = new Date(Date.now() - config.windowSeconds * 1000).toISOString();

  // Best-effort prune.
  await client.rpc("prune_rate_limits", {
    bucket_filter: config.bucket,
    window_seconds: config.windowSeconds
  });

  const { count, error: countError } = await client
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", config.bucket)
    .gte("created_at", sinceIso);

  // Fail closed: treat a DB error as denied. Pairs with quota reservation
  // which already fails closed; the goal is that an attacker cannot bypass
  // the limiter by inducing transient DB pressure.
  if (countError) {
    console.error("rate-limit count failed", countError);
    return { allowed: false, remaining: 0 };
  }

  const used = count ?? 0;
  if (used >= config.limit) {
    return { allowed: false, remaining: 0 };
  }

  const { error: insertError } = await client
    .from("rate_limits")
    .insert({ bucket: config.bucket });

  if (insertError) {
    console.error("rate-limit insert failed", insertError);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: Math.max(0, config.limit - used - 1) };
}
