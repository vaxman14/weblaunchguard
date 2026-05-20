import Stripe from "stripe";
import { errorResponse, jsonResponse, requireMethod, type NetlifyEvent } from "./_lib/http";
import { findPersonalWorkspaceId, serverSupabaseClient } from "./_lib/supabase";
import { billingIntervalFromString, priceIdToTierAndInterval, tierFromString, type BillingInterval, type Tier } from "./_lib/tiers";

export type SubscriptionRecord = {
  customerId: string;
  interval: BillingInterval | null;
  periodEnd: string | null;
  periodStart: string | null;
  priceId: string | null;
  status: string;
  stripeSubscriptionId: string;
  tier: Tier | null;
  userId: string | null;
};

const stripeApiVersion = "2025-02-24.acacia";
const mirroredStatuses = new Set(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired"]);
const subscriptionEventTypes = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey, { apiVersion: stripeApiVersion });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function metadataValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return stringValue((metadata as Record<string, unknown>)[key]);
}

function periodTimestamp(value: unknown): string | null {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function firstSubscriptionItem(subscription: Record<string, unknown>) {
  const items = subscription.items;
  if (!items || typeof items !== "object") {
    return null;
  }

  const data = (items as Record<string, unknown>).data;
  return Array.isArray(data) && data[0] && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : null;
}

function tierFromSubscription(subscription: Record<string, unknown>, priceId: string | null): Tier | null {
  const metaTier = tierFromString(metadataValue(subscription.metadata, "tier"));
  if (metaTier) {
    return metaTier;
  }

  if (priceId) {
    const inferred = priceIdToTierAndInterval(priceId);
    if (inferred) {
      return inferred.tier;
    }
  }

  return null;
}

function intervalFromSubscription(subscription: Record<string, unknown>, priceId: string | null, recurring: unknown): BillingInterval | null {
  const metaInterval = billingIntervalFromString(metadataValue(subscription.metadata, "billingInterval"));
  if (metaInterval) {
    return metaInterval;
  }

  if (priceId) {
    const inferred = priceIdToTierAndInterval(priceId);
    if (inferred) {
      return inferred.interval;
    }
  }

  if (recurring && typeof recurring === "object") {
    const interval = (recurring as Record<string, unknown>).interval;
    if (interval === "month") return "monthly";
    if (interval === "year") return "annual";
  }

  return null;
}

export function mapSubscriptionObject(subscription: Record<string, unknown>): SubscriptionRecord | null {
  const customerId = stringValue(subscription.customer);
  const stripeSubscriptionId = stringValue(subscription.id);
  const status = stringValue(subscription.status);
  const item = firstSubscriptionItem(subscription);
  const price = item?.price;
  const priceId = price && typeof price === "object" ? stringValue((price as Record<string, unknown>).id) : null;
  const recurring = price && typeof price === "object" ? (price as Record<string, unknown>).recurring : null;

  if (!customerId || !stripeSubscriptionId || !status) {
    return null;
  }

  return {
    customerId,
    interval: intervalFromSubscription(subscription, priceId, recurring),
    periodEnd: periodTimestamp(subscription.current_period_end),
    periodStart: periodTimestamp(subscription.current_period_start),
    priceId,
    status: mirroredStatuses.has(status) ? status : "inactive",
    stripeSubscriptionId,
    tier: tierFromSubscription(subscription, priceId),
    userId: metadataValue(subscription.metadata, "userId")
  };
}

export function mapStripeEventToSubscriptionRecord(event: {
  data?: { object?: unknown };
  id?: string;
  type?: string;
}): SubscriptionRecord | null {
  if (!event.type || !subscriptionEventTypes.has(event.type)) {
    return null;
  }

  const object = event.data?.object;
  if (!object || typeof object !== "object") {
    return null;
  }

  return mapSubscriptionObject(object as Record<string, unknown>);
}

function stripeSignature(event: NetlifyEvent): string | null {
  const headers = event.headers ?? {};
  return headers["stripe-signature"] ?? headers["Stripe-Signature"] ?? null;
}

async function recordSubscriptionChange(record: SubscriptionRecord | null) {
  if (!record?.userId || !record.tier) {
    return { persisted: false, record };
  }

  const client = serverSupabaseClient();

  // Confirm the userId in the webhook metadata refers to a real auth user
  // before letting findPersonalWorkspaceId auto-create a workspace. Stripe
  // signature verification has already guaranteed authenticity, but this
  // guards against malformed payloads or accidental reuse of a stale
  // metadata id from a deleted account.
  const { data: authUser, error: authLookupError } = await client.auth.admin.getUserById(record.userId);
  if (authLookupError || !authUser?.user) {
    console.error("stripe-webhook: unknown userId in metadata", { userId: record.userId });
    return { persisted: false, record };
  }

  const workspaceId = await findPersonalWorkspaceId(client, {
    email: authUser.user.email ?? undefined,
    id: record.userId
  });

  const { data: existingSub } = await client
    .from("subscriptions")
    .select("manual_override")
    .eq("stripe_subscription_id", record.stripeSubscriptionId)
    .maybeSingle();

  if (existingSub?.manual_override) {
    console.log("stripe-webhook: skipping admin-assigned manual override subscription", record.stripeSubscriptionId);
    return { persisted: false, record };
  }

  const { error } = await client.from("subscriptions").upsert(
    {
      billing_interval: record.interval,
      current_period_end: record.periodEnd,
      current_period_start: record.periodStart,
      status: record.status,
      stripe_customer_id: record.customerId,
      stripe_price_id: record.priceId,
      stripe_subscription_id: record.stripeSubscriptionId,
      tier: record.tier,
      updated_at: new Date().toISOString(),
      user_id: record.userId,
      workspace_id: workspaceId
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (error) {
    throw new Error("Subscription persistence failed.");
  }

  return { persisted: true, record };
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return errorResponse("Webhook is not configured.", 500);
  }

  const signature = stripeSignature(event);
  if (!signature) {
    return errorResponse("Missing Stripe signature.", 400);
  }

  const rawBody = event.rawBody ?? event.body ?? "";

  try {
    const stripeEvent = stripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
    const record = mapStripeEventToSubscriptionRecord(stripeEvent);
    const result = await recordSubscriptionChange(record);
    return jsonResponse({ handled: Boolean(record), persisted: result.persisted });
  } catch {
    return errorResponse("Webhook handling failed.", 400);
  }
}
