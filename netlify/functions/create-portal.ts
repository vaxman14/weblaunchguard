import Stripe from "stripe";
import { errorResponse, jsonResponse, requireMethod, type NetlifyEvent } from "./_lib/http";
import { trustedSiteUrl } from "./_lib/site-url";
import { requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";

const stripeApiVersion = "2025-02-24.acacia";

function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey, { apiVersion: stripeApiVersion });
}

async function stripeCustomerIdForUser(userId: string): Promise<string | null> {
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

  try {
    const authResult = await requireAuthenticatedUser(event);
    if (authResult.response) {
      return authResult.response;
    }

    const customerId = await stripeCustomerIdForUser(authResult.user.id);
    if (!customerId) {
      return errorResponse("A Stripe customer was not found for this account.", 404);
    }

    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${trustedSiteUrl()}/dashboard`
    });

    if (!session.url) {
      return errorResponse("Stripe did not return a Customer Portal URL.", 502);
    }

    return jsonResponse({ url: session.url });
  } catch {
    return errorResponse("Customer Portal session creation failed.", 500);
  }
}
