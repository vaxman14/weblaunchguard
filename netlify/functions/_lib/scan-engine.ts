import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { resolvePublicAddress, type BoundAddress } from "./network";

export type FindingSeverity = "low" | "medium" | "high";

export type FindingCategory =
  | "transport"
  | "security-headers"
  | "privacy-headers"
  | "cookies"
  | "accessibility"
  | "seo"
  | "performance"
  | "conversion"
  | "best-practices"
  | "soc2"
  | "ai-review"
  | "controlled-inspection"
  | "general";

export type ScanFinding = {
  category: FindingCategory;
  description: string;
  evidence?: string;
  id: string;
  remediation?: string;
  severity: FindingSeverity;
  title: string;
};

export type PassiveAnalysisInput = {
  finalUrl: string;
  headers: Record<string, string | string[]>;
  html: string;
  htmlTruncated?: boolean;
  initialUrl: string;
  status: number;
};

export type PassiveAnalysisReport = {
  finalUrl: string;
  findings: ScanFinding[];
  generatedAt: string;
  htmlTruncated: boolean;
  initialUrl: string;
  status: number;
  summary: string;
};

export type FetchedResponse = {
  body: string;
  finalUrl: string;
  headers: Record<string, string | string[]>;
  htmlTruncated: boolean;
  status: number;
};

const timeoutMs = 7000;
const htmlByteLimit = 3_000_000;
const maxRedirects = 5;

// HTTP fetcher that re-resolves DNS on every redirect and binds the request
// to the resolved IP — defends against DNS rebinding mid-flight.
export async function fetchWithGuards(url: URL): Promise<FetchedResponse> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const boundAddress = await resolvePublicAddress(currentUrl);
    const response = await requestBoundUrl(currentUrl, boundAddress);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = headerString(response.headers.location);
    if (!location) {
      throw new Error("Redirect response did not include a location.");
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      throw new Error("Redirect target must use http or https.");
    }

    currentUrl = nextUrl;
  }

  throw new Error("Too many redirects.");
}

// Turn a fetch/DNS/TLS failure into a user-facing { status, message } so the
// scan endpoints can explain *why* a site couldn't be scanned instead of always
// saying "unable to fetch site".
export function describeFetchError(err: unknown): { message: string; status: number } {
  const code = (err as NodeJS.ErrnoException)?.code ?? "";
  const msg = err instanceof Error ? err.message : "";

  // Domain doesn't resolve — almost always a typo or an unpublished site.
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(msg)) {
    return {
      message:
        "We couldn't find that domain. Check the spelling and make sure it's a real, published website (for example, https://example.com).",
      status: 400
    };
  }

  // Validation rejected it before we ever connected (private/blocked host, bad scheme).
  if (/public URL targets/i.test(msg)) {
    return { message: "That address isn't a public website we can scan. Enter a public https:// URL.", status: 400 };
  }
  if (/http or https/i.test(msg)) {
    return { message: "Only http and https websites can be scanned.", status: 400 };
  }

  // Redirect problems.
  if (/Too many redirects/i.test(msg)) {
    return { message: "That site redirected too many times. Try entering its exact final URL.", status: 400 };
  }
  if (/Redirect target must use|did not include a location/i.test(msg)) {
    return { message: "That site sent a redirect we couldn't follow. Try entering the exact page URL.", status: 400 };
  }

  // Timeout.
  if (code === "ETIMEDOUT" || /timed out|timeout/i.test(msg)) {
    return {
      message: "The site took too long to respond. It may be slow, overloaded, or blocking automated requests.",
      status: 504
    };
  }

  // Connection refused / reset / unreachable.
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"].includes(code)) {
    return { message: "We couldn't connect to that site. It may be down or blocking automated requests.", status: 502 };
  }

  // TLS / certificate problems.
  if (/CERT|TLS|SSL|SELF_SIGNED|ALTNAME/i.test(code) || /certificate|self.signed|SSL|TLS/i.test(msg)) {
    return { message: "The site has an SSL/TLS certificate problem we couldn't get past.", status: 502 };
  }

  return { message: "We couldn't reach that site. It may be down or blocking automated requests.", status: 502 };
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function headersToRecord(headers: http.IncomingHttpHeaders): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    record[key.toLowerCase()] = value;
  }
  return record;
}

function requestBoundUrl(url: URL, boundAddress: BoundAddress): Promise<FetchedResponse> {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        },
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            (callback as (err: null, addrs: { address: string; family: number }[]) => void)(
              null,
              [{ address: boundAddress.address, family: boundAddress.family }]
            );
          } else {
            callback(null, boundAddress.address, boundAddress.family);
          }
        },
        timeout: timeoutMs
      },
      (response) => {
        const headers = headersToRecord(response.headers);
        const contentType = (headerString(headers["content-type"]) ?? "").toLowerCase();
        const isRedirect = [301, 302, 303, 307, 308].includes(response.statusCode ?? 0);

        if (isRedirect || !contentType.includes("text/html")) {
          response.resume();
          response.on("end", () => {
            resolve({
              body: "",
              finalUrl: url.toString(),
              headers,
              htmlTruncated: false,
              status: response.statusCode ?? 0
            });
          });
          return;
        }

        readLimitedBody(response, htmlByteLimit)
          .then(({ body, truncated }) => {
            resolve({
              body,
              finalUrl: url.toString(),
              headers,
              htmlTruncated: truncated,
              status: response.statusCode ?? 0
            });
          })
          .catch(reject);
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Request timed out."));
    });
    request.on("error", reject);
    request.end();
  });
}

function readLimitedBody(
  response: IncomingMessage,
  byteLimit: number
): Promise<{ body: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let truncated = false;
    let settled = false;

    function finish() {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ body: Buffer.concat(chunks).toString("utf8"), truncated });
    }

    response.on("data", (chunk: Buffer) => {
      const remaining = byteLimit - received;
      if (remaining <= 0) {
        truncated = true;
        response.destroy();
        finish();
        return;
      }

      const usable = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk;
      chunks.push(usable);
      received += usable.byteLength;

      if (chunk.byteLength > remaining) {
        truncated = true;
        response.destroy();
        finish();
      }
    });

    response.on("end", finish);
    response.on("error", (error) => {
      if (settled) {
        return;
      }

      reject(error);
    });
  });
}

// --- Passive analyzers -----------------------------------------------------

function hasHeader(headers: Record<string, string | string[]>, name: string): boolean {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value.some((entry) => entry.trim().length > 0);
  }
  return Boolean(value?.trim());
}

function hasMetaCsp(html: string): boolean {
  return /<meta[^>]*\bhttp-equiv\s*=\s*["']Content-Security-Policy["'][^>]*\bcontent\s*=/i.test(html);
}

function setCookieValues(headers: Record<string, string | string[]>): string[] {
  const value = headers["set-cookie"];
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean);
  }

  return [value.trim()];
}

function cookieMissingFlag(cookie: string, flag: string): boolean {
  const pattern = new RegExp(`(?:^|;)\\s*${flag}(?:\\s|;|=|$)`, "i");
  return !pattern.test(cookie);
}

function hasDocumentLanguage(html: string): boolean {
  return /<html\b[^>]*\blang\s*=\s*["'][^"']+["'][^>]*>/i.test(html);
}

function hasH1(html: string): boolean {
  return /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html);
}

function hasImageWithoutAlt(html: string): boolean {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  return tags.some((tag) => !/\balt\s*=/i.test(tag));
}

// Per-form heuristic: any form with at least one non-hidden input must
// reference a label (either a <label> inside the form, or aria-label /
// aria-labelledby on the controls).
function hasUnlabeledFormControl(html: string): boolean {
  const formTags = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  if (formTags.length === 0) {
    return false;
  }

  return formTags.some((form) => {
    const controls = form.match(/<(input|select|textarea)\b[^>]*>/gi) ?? [];
    const visibleControls = controls.filter((control) => !/\btype\s*=\s*["']hidden["']/i.test(control));
    if (visibleControls.length === 0) {
      return false;
    }

    const formHasLabel = /<label\b/i.test(form);
    const allControlsLabeled = visibleControls.every((control) => /\baria-label(?:ledby)?\s*=/i.test(control));
    return !formHasLabel && !allControlsLabeled;
  });
}

// --- SEO / conversion / platform helpers (all from the single passive fetch) ---

function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function metaByName(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]*\\bname\\s*=\\s*["']${name}["'][^>]*\\bcontent\\s*=\\s*["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function hasMetaProperty(html: string, prop: string): boolean {
  return new RegExp(`<meta[^>]*\\bproperty\\s*=\\s*["']${prop}["']`, "i").test(html);
}

function hasLinkRel(html: string, rel: string): boolean {
  return new RegExp(`<link[^>]*\\brel\\s*=\\s*["'][^"']*${rel}[^"']*["']`, "i").test(html);
}

function hasJsonLd(html: string): boolean {
  return /<script[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
}

function mixedContentResources(html: string): string[] {
  const hits = [...html.matchAll(/\b(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi)]
    .map((m) => m[1])
    // ignore plain anchor links to other http pages; flag loadable sub-resources
    .filter((u) => /\.(?:js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|json)(?:\?|$)/i.test(u));
  return Array.from(new Set(hits)).slice(0, 5);
}

function detectBuilder(html: string, headers: Record<string, string | string[]>): string | null {
  // Match real infrastructure fingerprints only — CDN hostnames, platform
  // headers, asset hosts, and <meta generator> tags. Never match a bare brand
  // word, which shows up in ordinary page copy (e.g. an agency listing the
  // platforms it builds on) and produces false positives.
  const hay = (html + " " + JSON.stringify(headers)).toLowerCase();
  const generator = (metaByName(html, "generator") || "").toLowerCase();

  if (/wixstatic\.com|parastorage\.com|x-wix-|_wixcss|wix-bolt/.test(hay) || generator.includes("wix")) return "Wix";
  if (/static1\.squarespace\.com|sqsp\.net|squarespace\.com\/(?:universal|static)|squarespace_context/.test(hay) || generator.includes("squarespace")) return "Squarespace";
  if (/cdn\.shopify\.com|myshopify\.com|x-shopify-|shopifycloud|shopify\.theme|window\.shopify/.test(hay) || generator.includes("shopify")) return "Shopify";
  if (/wp-content\/|wp-includes\/|\/wp-json|x-wp-/.test(hay) || generator.includes("wordpress")) return "WordPress";
  if (/assets(?:-global)?\.website-files\.com|\.webflow\.io|data-wf-(?:page|site)/.test(hay) || generator.includes("webflow")) return "Webflow";
  if (/\.godaddysites\.com|img1?\.wsimg\.com/.test(hay) || generator.includes("godaddy")) return "GoDaddy Website Builder";
  if (/\.weebly\.com|cdn2\.editmysite\.com/.test(hay) || generator.includes("weebly")) return "Weebly";
  return null;
}

// Visible text with tags/scripts/styles stripped — used to detect empty SPA shells.
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A client-rendered SPA serves a near-empty HTML shell (a root <div> + an
// "enable JavaScript" notice); all real content is painted by JS after load.
// Tools, crawlers, and link scrapers that don't run JS see nothing — so any
// content-based finding from the shell is a false positive.
export function isClientRenderedShell(html: string): boolean {
  if (!html) return false;
  const text = visibleText(html);
  const hasAppRoot = /<div[^>]+id\s*=\s*["'](root|app|__next|__nuxt|gatsby-focus-wrapper)["']/i.test(html);
  const noscriptHint = /enable javascript|you need to enable|please enable js/i.test(html);
  return text.length < 250 && (hasAppRoot || noscriptHint);
}

function analyzeSeoConversion(input: PassiveAnalysisInput): ScanFinding[] {
  const out: ScanFinding[] = [];
  const html = input.html;
  if (!html) return out;

  const spaShell = isClientRenderedShell(html);
  if (spaShell) {
    out.push({ category: "best-practices", id: "client-side-rendered", severity: "high",
      title: "Content is rendered entirely in the browser (no server-rendered HTML)",
      description: "The page's HTML is an almost-empty shell — all content is drawn by JavaScript after the page loads. Search engines, social link-preview scrapers, and assistive tools that don't run JavaScript see a blank page, which hurts SEO and sharing. (Automated scanners can only read the shell, so some content checks below are skipped to avoid false alarms.)",
      remediation: "Add server-side rendering (SSR) or static pre-rendering so the core content, headings, and contact details are present in the initial HTML." });
  }

  // --- SEO ---
  const title = pageTitle(html);
  if (!title) {
    out.push({ category: "seo", id: "seo-title-missing", severity: "high", title: "Page title is missing",
      description: "The homepage has no <title> tag, which Google uses as the headline in search results.",
      remediation: "Add a unique, descriptive <title> of about 50–60 characters." });
  } else if (title.length < 15 || title.length > 65) {
    out.push({ category: "seo", id: "seo-title-length", severity: "low", title: "Page title length is off",
      description: `The title is ${title.length} characters; Google shows roughly 50–60 before truncating.`,
      remediation: "Aim for a focused 50–60 character title that includes your business and location." });
  }

  if (!metaByName(html, "description")) {
    out.push({ category: "seo", id: "seo-meta-description-missing", severity: "medium", title: "Meta description is missing",
      description: "No meta description was found. Google often uses it as the snippet under your search result.",
      remediation: "Add a compelling 140–160 character meta description with a call to action." });
  }

  if (!hasMetaProperty(html, "og:title") || !hasMetaProperty(html, "og:image")) {
    out.push({ category: "seo", id: "seo-open-graph-missing", severity: "low", title: "Social sharing preview is incomplete",
      description: "Open Graph tags (og:title/og:image) are missing, so links shared on Facebook, iMessage, and LinkedIn look plain or broken.",
      remediation: "Add Open Graph and Twitter Card tags with a title, description, and preview image." });
  }

  if (!hasJsonLd(html)) {
    out.push({ category: "seo", id: "seo-structured-data-missing", severity: "medium", title: "No local business structured data",
      description: "No JSON-LD structured data was found. LocalBusiness schema helps you show up in Google Maps and local results with hours, address, and reviews.",
      remediation: "Add LocalBusiness (or Organization) JSON-LD with your name, address, phone, and hours." });
  }

  if (!hasLinkRel(html, "canonical")) {
    out.push({ category: "seo", id: "seo-canonical-missing", severity: "low", title: "Canonical URL is missing",
      description: "No canonical link tag was found, which can cause duplicate-content confusion for search engines.",
      remediation: "Add <link rel=\"canonical\"> pointing to the preferred URL of each page." });
  }

  if (!hasLinkRel(html, "icon")) {
    out.push({ category: "best-practices", id: "favicon-missing", severity: "low", title: "Favicon is missing",
      description: "No favicon was declared, so the site shows a blank icon in browser tabs and bookmarks.",
      remediation: "Add a favicon link so your brand mark appears in tabs." });
  }

  // --- Mobile ---
  if (!metaByName(html, "viewport")) {
    out.push({ category: "best-practices", id: "viewport-missing", severity: "high", title: "Not mobile-optimized",
      description: "No responsive viewport meta tag was found. The site likely renders zoomed-out and hard to use on phones — where most local traffic comes from.",
      remediation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> and verify the layout is responsive." });
  }

  // --- Conversion signals ---
  const hasTel = /\bhref\s*=\s*["']tel:/i.test(html);
  const hasMailto = /\bhref\s*=\s*["']mailto:/i.test(html);
  const hasForm = /<form\b/i.test(html);
  const hasBooking = /calendly|acuityscheduling|squareup\.com\/appointments|setmore|youcanbook|book[-_]?now|schedule/i.test(html);
  // A link to a dedicated contact/get-in-touch page is also a valid contact path.
  const hasContactLink = /href\s*=\s*["'][^"']*(?:contact|get[-_ ]?in[-_ ]?touch|reach[-_ ]?us)[^"']*["']/i.test(html);

  if (!hasTel && !input.htmlTruncated && !spaShell) {
    out.push({ category: "conversion", id: "conversion-no-click-to-call", severity: "medium", title: "No click-to-call link",
      description: "No tap-to-call (tel:) link was found. On mobile, a tappable phone number is one of the highest-converting elements a local business can have.",
      remediation: "Make your phone number a tel: link so mobile visitors can call in one tap — and consider a 24/7 answering service so no call is missed." });
  }
  // Only claim "no contact path" if we actually read the whole page. On a truncated
  // fetch the contact info often lives in the footer we never reached — firing a HIGH
  // there is a false positive that destroys credibility with a prospect.
  if (!hasForm && !hasMailto && !hasTel && !hasContactLink && !input.htmlTruncated && !spaShell) {
    out.push({ category: "conversion", id: "conversion-no-contact-path", severity: "high", title: "No clear way to get in touch",
      description: "No contact form, email link, tap-to-call number, or contact page was found. Visitors who can't easily reach you usually leave.",
      remediation: "Add a simple contact form, a visible email/phone link, or a clearly linked contact page above the fold." });
  }
  if (!hasBooking && !spaShell) {
    out.push({ category: "conversion", id: "conversion-no-booking", severity: "low", title: "No online booking detected",
      description: "No scheduling or booking link was found. Letting customers book themselves captures leads even after hours.",
      remediation: "Add online scheduling (or an AI booking assistant) so visitors can book without calling during business hours." });
  }

  // --- Mixed content (only meaningful on HTTPS pages) ---
  try {
    if (new URL(input.finalUrl).protocol === "https:") {
      const mixed = mixedContentResources(html);
      if (mixed.length) {
        out.push({ category: "security-headers", id: "mixed-content", severity: "medium", title: "Insecure (mixed) content loaded",
          description: `The secure page loads ${mixed.length} resource(s) over plain http://, which browsers may block and which breaks the padlock.`,
          evidence: mixed.join(", "),
          remediation: "Load every script, style, image, and font over https://." });
      }
    }
  } catch { /* ignore URL parse */ }

  // --- Platform / build quality ---
  const builder = detectBuilder(html, input.headers);
  if (builder) {
    out.push({ category: "best-practices", id: "diy-platform", severity: "low", title: `Built on ${builder}`,
      description: `This site appears to run on ${builder}, a template builder. That's fine to start, but template sites are often slower, harder to optimize, and look like everyone else's.`,
      remediation: "A custom-built site loads faster, ranks better, and gives your brand a distinct, professional presence." });
  }

  return out;
}

export function analyzePassive(input: PassiveAnalysisInput): PassiveAnalysisReport {
  const findings: ScanFinding[] = [];
  const initialUrl = new URL(input.initialUrl);
  const finalUrl = new URL(input.finalUrl);

  if (finalUrl.protocol !== "https:") {
    findings.push({
      category: "transport",
      description: "The final page did not load over HTTPS.",
      id: "https-not-used",
      remediation: "Serve all production pages over HTTPS and redirect HTTP traffic.",
      severity: "high",
      title: "HTTPS is not in use"
    });
  } else if (initialUrl.protocol === "http:" && finalUrl.protocol === "https:") {
    findings.push({
      category: "transport",
      description: "The HTTP URL redirected to HTTPS, which is a positive launch signal.",
      id: "https-redirect-present",
      severity: "low",
      title: "HTTP redirects to HTTPS"
    });
  }

  if (!hasHeader(input.headers, "strict-transport-security")) {
    findings.push({
      category: "security-headers",
      description: "Strict-Transport-Security was not present on the response.",
      id: "missing-hsts",
      remediation: "Send Strict-Transport-Security with a max-age of at least 15552000.",
      severity: "medium",
      title: "HSTS is missing"
    });
  }

  if (!hasHeader(input.headers, "content-security-policy") && !hasMetaCsp(input.html)) {
    findings.push({
      category: "security-headers",
      description: "No Content-Security-Policy was sent in the response header or meta element.",
      id: "missing-csp",
      remediation: "Define a Content-Security-Policy that whitelists trusted sources.",
      severity: "medium",
      title: "CSP is missing"
    });
  }

  if (!hasHeader(input.headers, "x-frame-options") && !hasHeader(input.headers, "content-security-policy")) {
    findings.push({
      category: "security-headers",
      description: "Neither X-Frame-Options nor a CSP frame-ancestors directive was sent.",
      id: "missing-frame-protection",
      remediation: "Send X-Frame-Options: DENY (or SAMEORIGIN) or set CSP frame-ancestors.",
      severity: "low",
      title: "Frame protection is missing"
    });
  }

  if (!hasHeader(input.headers, "referrer-policy")) {
    findings.push({
      category: "privacy-headers",
      description: "Referrer-Policy was not present on the response.",
      id: "missing-referrer-policy",
      remediation: "Send Referrer-Policy: strict-origin-when-cross-origin or stricter.",
      severity: "low",
      title: "Referrer policy is missing"
    });
  }

  if (!hasHeader(input.headers, "permissions-policy")) {
    findings.push({
      category: "privacy-headers",
      description: "Permissions-Policy was not present on the response.",
      id: "missing-permissions-policy",
      remediation: "Send Permissions-Policy with an explicit allowlist for sensitive features.",
      severity: "low",
      title: "Permissions policy is missing"
    });
  }

  const cookies = setCookieValues(input.headers);
  if (cookies.some((cookie) => cookieMissingFlag(cookie, "Secure"))) {
    findings.push({
      category: "cookies",
      description: "At least one cookie was set without the Secure flag.",
      id: "cookie-missing-secure",
      remediation: "Add the Secure flag so cookies are not sent over plaintext HTTP.",
      severity: "medium",
      title: "Cookie Secure flag is missing"
    });
  }

  if (cookies.some((cookie) => cookieMissingFlag(cookie, "HttpOnly"))) {
    findings.push({
      category: "cookies",
      description: "At least one cookie was set without the HttpOnly flag.",
      id: "cookie-missing-httponly",
      remediation: "Add HttpOnly to cookies that do not need to be readable from JavaScript.",
      severity: "low",
      title: "Cookie HttpOnly flag is missing"
    });
  }

  if (cookies.some((cookie) => cookieMissingFlag(cookie, "SameSite"))) {
    findings.push({
      category: "cookies",
      description: "At least one cookie was set without a SameSite value.",
      id: "cookie-missing-samesite",
      remediation: "Add SameSite=Lax (or Strict) so cookies are not sent on cross-site requests.",
      severity: "low",
      title: "Cookie SameSite value is missing"
    });
  }

  if (input.html && !hasDocumentLanguage(input.html)) {
    findings.push({
      category: "accessibility",
      description: "The html element did not include a detectable lang attribute.",
      id: "missing-document-language",
      remediation: "Add a lang attribute to the <html> element (e.g. <html lang=\"en\">).",
      severity: "medium",
      title: "Document language is missing"
    });
  }

  if (input.html && !hasH1(input.html) && !isClientRenderedShell(input.html)) {
    findings.push({
      category: "accessibility",
      description: "No h1 heading was detected in the returned HTML.",
      id: "missing-h1",
      remediation: "Add a single descriptive <h1> heading near the top of the page.",
      severity: "low",
      title: "Primary heading was not detected"
    });
  }

  if (input.html && hasImageWithoutAlt(input.html)) {
    findings.push({
      category: "accessibility",
      description: "At least one image did not include an alt attribute.",
      id: "image-alt-missing",
      remediation: "Add alt text to informative images, or alt=\"\" for decorative ones.",
      severity: "low",
      title: "Image alt text is missing"
    });
  }

  if (input.html && hasUnlabeledFormControl(input.html)) {
    findings.push({
      category: "accessibility",
      description: "A form was detected with controls that have no <label> or aria-label.",
      id: "form-labels-missing",
      remediation: "Associate every visible form control with a <label> or aria-label.",
      severity: "medium",
      title: "Form labels may be missing"
    });
  }

  // SEO, conversion, mobile, mixed-content, and platform checks.
  findings.push(...analyzeSeoConversion(input));

  return {
    finalUrl: input.finalUrl,
    findings,
    generatedAt: new Date().toISOString(),
    htmlTruncated: Boolean(input.htmlTruncated),
    initialUrl: input.initialUrl,
    status: input.status,
    summary:
      findings.length === 1
        ? "1 passive finding."
        : `${findings.length} passive findings.`
  };
}

export const __testables = {
  hasUnlabeledFormControl,
  hasMetaCsp,
  setCookieValues
};
