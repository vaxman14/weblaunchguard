import * as dns from "node:dns/promises";
import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { requireAuthenticatedUser, serverSupabaseClient } from "./_lib/supabase";

type VerifyDomainRequest = {
  domainId?: string;
};

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((chunks) => chunks.join(""));
}

async function resolveTxtSafely(hostname: string): Promise<string[]> {
  try {
    return flattenTxtRecords(await dns.resolveTxt(hostname));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND") {
      return [];
    }

    throw error;
  }
}

export async function checkDomainVerification(hostname: string, verificationToken: string) {
  const expectedValue = `weblaunchguard-verify=${verificationToken}`;
  const checkedHostnames = [`_weblaunchguard.${hostname}`, hostname];
  const txtRecords = await Promise.all(checkedHostnames.map((name) => resolveTxtSafely(name)));

  return {
    checkedHostnames,
    expectedValue,
    verified: txtRecords.some((records) => records.includes(expectedValue))
  };
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) {
    return methodError;
  }

  const body = parseJsonBody<VerifyDomainRequest>(event);
  if (!body?.domainId) {
    return errorResponse("domainId is required.", 400);
  }

  const authResult = await requireAuthenticatedUser(event);
  if (authResult.response) {
    return authResult.response;
  }

  const client = serverSupabaseClient();

  // Brake DNS-lookup hammering per IP (authenticated, but cheap to spam).
  const ip = clientIpAddress(event);
  const rateLimit = await consumeRateLimit(client, {
    bucket: `ip:${ip}:verify-domain`,
    limit: 60,
    windowSeconds: 3600
  });
  if (!rateLimit.allowed) {
    return errorResponse("Too many verification checks. Try again shortly.", 429);
  }

  const { data: domain, error: lookupError } = await client
    .from("domains")
    .select("id,hostname,verification_status,verification_token")
    .eq("id", body.domainId)
    .eq("user_id", authResult.user.id)
    .maybeSingle();

  if (lookupError) {
    return errorResponse("Domain lookup failed.", 500);
  }

  if (!domain) {
    return errorResponse("Domain was not found for this account.", 404);
  }

  if (!domain.verification_token) {
    return errorResponse("Verification token is missing for this domain.", 500);
  }

  let verification: Awaited<ReturnType<typeof checkDomainVerification>>;
  try {
    verification = await checkDomainVerification(domain.hostname as string, domain.verification_token as string);
  } catch {
    return errorResponse("DNS TXT lookup failed.", 502);
  }

  // Only ever transition pending -> verified. A failed re-check on an
  // already-verified domain (transient DNS issue, propagation lag) must not
  // downgrade the row — users explicitly remove a domain to drop verified
  // status.
  if (verification.verified && domain.verification_status !== "verified") {
    const { error: updateError } = await client
      .from("domains")
      .update({
        updated_at: new Date().toISOString(),
        verification_status: "verified",
        verified_at: new Date().toISOString()
      })
      .eq("id", domain.id);

    if (updateError) {
      return errorResponse("Domain status could not be saved.", 500);
    }
  }

  return jsonResponse({
    checkedHostnames: verification.checkedHostnames,
    expectedValue: verification.expectedValue,
    hostname: domain.hostname,
    previousStatus: domain.verification_status,
    verified: verification.verified
  });
}
