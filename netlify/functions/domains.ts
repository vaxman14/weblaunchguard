import { randomBytes } from "node:crypto";
import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { findPersonalWorkspaceId, requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";
import { tierConfig, type Tier } from "./_lib/tiers";

type DomainsRequest = {
  action?: "create" | "delete";
  domainId?: string;
  hostname?: string;
  subscriptionId?: string;
};

const blockedNamePatterns = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.home$/i,
  /\.test$/i,
  /\.example$/i,
  /\.invalid$/i
];

function normalizeHostname(input: string | undefined): string {
  return input?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "") ?? "";
}

function isValidPublicHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  if (hostname.includes("/") || hostname.includes(":") || hostname.includes("@")) {
    return false;
  }

  if (blockedNamePatterns.some((pattern) => pattern.test(hostname))) {
    return false;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function generateVerificationToken(): string {
  return `wlguard_${randomBytes(16).toString("hex")}`;
}

async function handleCreate(event: NetlifyEvent, request: DomainsRequest) {
  const hostname = normalizeHostname(request.hostname);
  if (!isValidPublicHostname(hostname)) {
    return errorResponse("Enter a valid public hostname (e.g. example.com).", 400);
  }

  if (!request.subscriptionId || typeof request.subscriptionId !== "string") {
    return errorResponse("A subscription is required to add a domain.", 400);
  }

  const authResult = await requireAuthenticatedUser(event);
  if (authResult.response) {
    return authResult.response;
  }

  const client = serverSupabaseClient();
  const workspaceId = await findPersonalWorkspaceId(client, {
    email: authResult.user.email,
    id: authResult.user.id
  });

  const { data: subscription, error: subscriptionError } = await client
    .from("subscriptions")
    .select("id,user_id,tier,status")
    .eq("id", request.subscriptionId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (subscriptionError) {
    return errorResponse("Subscription lookup failed.", 500);
  }

  if (!subscription) {
    return errorResponse("Subscription was not found for this account.", 404);
  }

  const tier = subscription.tier as Tier;
  if (!tierConfig[tier]) {
    return errorResponse("Subscription tier is not supported.", 400);
  }

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return errorResponse("Add a domain after the subscription becomes active.", 402);
  }

  const { count, error: countError } = await client
    .from("domains")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", request.subscriptionId);

  if (countError) {
    return errorResponse("Domain lookup failed.", 500);
  }

  if ((count ?? 0) >= tierConfig[tier].maxDomains) {
    return errorResponse(
      `${tierConfig[tier].label} subscriptions allow up to ${tierConfig[tier].maxDomains} domain${
        tierConfig[tier].maxDomains === 1 ? "" : "s"
      }.`,
      409
    );
  }

  const verificationToken = generateVerificationToken();

  const { data: inserted, error: insertError } = await client
    .from("domains")
    .insert({
      hostname,
      subscription_id: request.subscriptionId,
      user_id: authResult.user.id,
      verification_status: "pending",
      verification_token: verificationToken,
      workspace_id: workspaceId
    })
    .select("id,hostname,verification_status,verification_token,subscription_id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return errorResponse("That domain is already registered in this workspace.", 409);
    }

    return errorResponse("Domain could not be saved.", 500);
  }

  return jsonResponse({ domain: inserted }, 201);
}

async function handleDelete(event: NetlifyEvent, request: DomainsRequest) {
  if (!request.domainId) {
    return errorResponse("domainId is required.", 400);
  }

  const authResult = await requireAuthenticatedUser(event);
  if (authResult.response) {
    return authResult.response;
  }

  const { error } = await serverSupabaseClient()
    .from("domains")
    .delete()
    .eq("id", request.domainId)
    .eq("user_id", authResult.user.id);

  if (error) {
    return errorResponse("Domain could not be removed.", 500);
  }

  return jsonResponse({ removed: true });
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const request = parseJsonBody<DomainsRequest>(event);
  if (!request) {
    return errorResponse("Invalid JSON body.", 400);
  }

  if (request.action === "delete") {
    return handleDelete(event, request);
  }

  if (request.action === "create" || !request.action) {
    return handleCreate(event, request);
  }

  return errorResponse("Unsupported domains action.", 400);
}
