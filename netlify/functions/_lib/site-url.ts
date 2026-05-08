// Returns a trusted public origin for building Stripe redirect URLs and
// similar. Never trusts caller-supplied Origin/Referer headers.

const fallbackUrl = "http://localhost:8888";

function isProduction(): boolean {
  if (process.env.NETLIFY_DEV) {
    return false;
  }

  const node = process.env.NODE_ENV?.trim().toLowerCase();
  const netlify = process.env.NETLIFY_CONTEXT?.trim().toLowerCase();
  return node === "production" || netlify === "production";
}

export function trustedSiteUrl(): string {
  const configured = process.env.URL?.trim() || process.env.SITE_URL?.trim();

  if (!configured) {
    if (isProduction()) {
      throw new Error("URL or SITE_URL must be set in production.");
    }

    return fallbackUrl;
  }

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      if (isProduction()) {
        throw new Error("URL must be https in production.");
      }

      return fallbackUrl;
    }

    return parsed.origin.replace(/\/$/, "");
  } catch (error) {
    if (isProduction()) {
      throw error instanceof Error ? error : new Error("URL must be a valid origin.");
    }

    return fallbackUrl;
  }
}
