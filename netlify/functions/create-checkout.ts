import Stripe from "stripe";
import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { trustedSiteUrl } from "./_lib/site-url";
import { requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import {
  billingIntervalFromString,
  priceIdForTier,
  tierFromString,
  type BillingInterval,
  type Tier
} from "./_lib/tiers";

type CheckoutRequest = {
  interval?: BillingInterval;
  tier?: Tier;
};

const stripeApiVersion = "2025-02-24.acacia";

function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey, { apiVersion: stripeApiVersion });
}

async function existingStripeCustomerId(userId: string): Promise<string | null> {
  const { data, error } = await serverSupabaseClient()
    .from("subscriptions")
    .select("stripe_customer_id,updated_at")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("Customer lookup failed.");
  }

  const row = Array.isArray(data) ? data[0] : null;
  return typeof row?.stripe_customer_id === "string" ? row.stripe_customer_id : null;
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const request = parseJsonBody<CheckoutRequest>(event);
  const tier = tierFromString(request?.tier);
  const interval = billingIntervalFromString(request?.interval);

  if (!tier) {
    return errorResponse("A tier of basic, pro, or enterprise is required.", 400);
  }

  if (!interval) {
    return errorResponse("A billing interval of monthly or annual is required.", 400);
  }

  try {
    const authResult = await requireAuthenticatedUser(event);
    if (authResult.response) {
      return authResult.response;
    }

    const siteUrl = trustedSiteUrl();
    const customerId = await existingStripeCustomerId(authResult.user.id);

    const session = await stripeClient().checkout.sessions.create({
      cancel_url: `${siteUrl}/dashboard?billing=cancelled`,
      client_reference_id: authResult.user.id,
      customer: customerId || undefined,
      customer_email: customerId ? undefined : authResult.user.email,
      line_items: [{ price: priceIdForTier(tier, interval), quantity: 1 }],
      metadata: {
        billingInterval: interval,
        tier,
        userId: authResult.user.id
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          billingInterval: interval,
          tier,
          userId: authResult.user.id
        }
      },
      success_url: `${siteUrl}/dashboard?billing=success`
    });

    if (!session.url) {
      return errorResponse("Stripe did not return a Checkout URL.", 502);
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error("create-checkout failed", {
      interval,
      message: error instanceof Error ? error.message : String(error),
      tier
    });
    return errorResponse("Checkout session creation failed.", 500);
  }
}
