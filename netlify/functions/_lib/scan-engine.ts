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
const htmlByteLimit = 250_000;
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

  if (input.html && !hasH1(input.html)) {
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
