import { generateFixPlan, type FixPlan } from "./_lib/anthropic";
import { errorResponse, jsonResponse, parseJsonBody, requireMethod, type NetlifyEvent } from "./_lib/http";
import { validateTargetUrl } from "./_lib/network";
import { clientIpAddress, consumeRateLimit } from "./_lib/rate-limit";
import { calculateRiskScore } from "./_lib/reports";
import { analyzePassive, describeFetchError, fetchWithGuards, type ScanFinding } from "./_lib/scan-engine";
import { generateSoc2Checklist } from "./_lib/soc2";
import { serverSupabaseClient } from "./_lib/supabase";

type LeadRequest = {
  business?: string;
  email?: string;
  name?: string;
  newsletter?: boolean;
  url?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mailFrom(): string {
  return process.env.WLG_MAIL_FROM?.trim() || "Web Launch Guard <noreply@donotreply.weblaunchguard.com>";
}

function siteUrl(): string {
  return process.env.SITE_URL?.trim() || process.env.URL?.trim() || "https://weblaunchguard.com";
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function fixPlanEmailBlock(fixPlan: FixPlan | null): string {
  if (!fixPlan) return "";
  const items = fixPlan.priorities
    .map(
      (p) => `<div style="margin-bottom:14px">
        <div style="font:600 14px Arial;color:#101828">${esc(p.problem)}</div>
        <div style="font:13px/1.5 Arial;color:#667085;margin:2px 0">${esc(p.impact)}</div>
        <div style="font:13px/1.5 Arial;color:#344054"><b style="color:#7c3aed">How we'd fix it:</b> ${esc(p.fix)}</div>
      </div>`
    )
    .join("");
  return `<div style="margin:22px 0;padding:18px;border:1px solid #eaecf0;border-radius:10px;background:#fbfaff">
    <div style="font:700 16px Arial;color:#101828;margin-bottom:6px">How CTF Designs would fix this</div>
    <div style="font:13px/1.6 Arial;color:#475467;margin-bottom:12px">${esc(fixPlan.intro)}</div>${items}</div>`;
}

function buildReportEmail(opts: { fixPlan: FixPlan | null; hostname: string; name: string; score: number; findings: ScanFinding[] }): string {
  const sevColor: Record<string, string> = { high: "#b42318", medium: "#b54708", low: "#475467" };
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const rows = [...opts.findings]
    .sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
    .map(
      (f) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top">
        <span style="display:inline-block;font:600 11px Arial;color:${sevColor[f.severity] || "#475467"};text-transform:uppercase">${esc(f.severity)}</span>
        <div style="font:600 15px Arial;color:#101828;margin:3px 0 2px">${esc(f.title)}</div>
        <div style="font:13px/1.5 Arial;color:#475467">${esc(f.description)}</div>
      </td></tr>`
    )
    .join("");
  const scoreColor = opts.score >= 80 ? "#067647" : opts.score >= 50 ? "#b54708" : "#b42318";
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#101828">
    <div style="border-bottom:3px solid #7c3aed;padding-bottom:14px;margin-bottom:8px">
      <span style="font:700 19px Arial">Web Launch <span style="color:#7c3aed">Guard</span></span>
      <span style="float:right;font:12px Arial;color:#667085">a free tool by CTF Designs</span>
    </div>
    <p style="font:14px/1.6 Arial;color:#344054">Hi ${esc(opts.name) || "there"}, here's your launch readiness report for <b>${esc(opts.hostname)}</b>.</p>
    <div style="background:#f9fafb;border:1px solid #eaecf0;border-radius:10px;padding:18px;text-align:center;margin:14px 0">
      <div style="font:800 44px Arial;color:${scoreColor};line-height:1">${opts.score}</div>
      <div style="font:12px Arial;color:#667085">RISK SCORE / 100 · ${opts.findings.length} issues found</div>
    </div>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    ${fixPlanEmailBlock(opts.fixPlan)}
    <div style="background:#0b0b14;border-radius:12px;padding:22px;margin:22px 0;text-align:center">
      <div style="font:700 18px Arial;color:#fff;margin-bottom:6px">Want these fixed for you?</div>
      <div style="font:14px/1.5 Arial;color:#cbd5e1;margin-bottom:14px">CTF Designs builds fast, secure, compliant websites — and can fix everything in this report.</div>
      <a href="https://ctfdesigns.com/contact.html" style="background:#7c3aed;color:#fff;text-decoration:none;font:600 14px Arial;padding:12px 26px;border-radius:30px;display:inline-block">Get this fixed →</a>
    </div>
    <p style="font:11px/1.5 Arial;color:#98a2b3;border-top:1px solid #eee;padding-top:12px">
      Web Launch Guard is a free, automated marketing tool by CTF Designs — not a professional security audit.
      Reports are informational and meant to be reviewed by CTF Designs. You received this because you requested a scan at
      <a href="${siteUrl()}" style="color:#7c3aed">weblaunchguard.com</a>.
    </p>
  </div>`;
}

async function sendReportEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error("submit-lead: RESEND_API_KEY not set; skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mailFrom(), to, subject, html })
    });
    if (!res.ok) {
      console.error("submit-lead: resend send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("submit-lead: resend send error", err);
  }
}

export async function handler(event: NetlifyEvent) {
  const methodError = requireMethod(event, "POST");
  if (methodError) return methodError;

  const body = parseJsonBody<LeadRequest>(event);
  if (!body) return errorResponse("Invalid JSON body.", 400);

  const name = (body.name ?? "").trim().slice(0, 120);
  const business = (body.business ?? "").trim().slice(0, 160);
  const email = (body.email ?? "").trim().slice(0, 200);
  if (!name || !business || !email) {
    return errorResponse("Name, business, and email are required.", 400);
  }
  if (!EMAIL_RE.test(email)) {
    return errorResponse("Please enter a valid email address.", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = validateTargetUrl(body.url);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Invalid URL.", 400);
  }

  const client = serverSupabaseClient();
  const ip = clientIpAddress(event);

  // Abuse brake (the scan + email are heavier than a demo).
  const rl = await consumeRateLimit(client, { bucket: `ip:${ip}:submit-lead`, limit: 15, windowSeconds: 3600 });
  if (!rl.allowed) {
    return errorResponse("You've run a lot of reports in a short time. Try again a little later.", 429);
  }

  let response: Awaited<ReturnType<typeof fetchWithGuards>>;
  try {
    response = await fetchWithGuards(targetUrl);
  } catch (err) {
    const { message, status } = describeFetchError(err);
    return errorResponse(message, status);
  }

  const report = analyzePassive({
    finalUrl: response.finalUrl,
    headers: response.headers,
    html: response.body,
    htmlTruncated: response.htmlTruncated,
    initialUrl: targetUrl.toString(),
    status: response.status
  });
  const soc2 = generateSoc2Checklist(report.findings);
  const riskScore = calculateRiskScore(report.findings);
  const hostname = new URL(report.finalUrl).hostname.replace(/^www\./, "");

  // AI closer: tailored "how CTF Designs fixes this" (best-effort — null if Groq is down/unset).
  const fixPlan = await generateFixPlan({
    business,
    findings: report.findings.map((f) => ({ category: f.category, severity: f.severity, title: f.title })),
    hostname
  });

  // Store the lead (best-effort — never fail the report on a storage hiccup).
  const { error: leadError } = await client.from("leads").insert({
    business,
    email,
    findings_count: report.findings.length,
    hostname,
    ip_address: ip === "unknown" ? null : ip,
    name,
    newsletter_opt_in: Boolean(body.newsletter),
    scanned_url: report.finalUrl,
    score: riskScore,
    user_agent: (event.headers?.["user-agent"] ?? "").slice(0, 400) || null
  });
  if (leadError) console.error("submit-lead: lead insert failed", leadError.message);

  // Email the report (best-effort; the on-screen report is the primary delivery).
  await sendReportEmail(
    email,
    `Your Web Launch Guard report for ${hostname} (score ${riskScore}/100)`,
    buildReportEmail({ findings: report.findings, fixPlan, hostname, name, score: riskScore })
  );

  return jsonResponse({
    emailed: true,
    findings: report.findings,
    finalUrl: report.finalUrl,
    fixPlan,
    generatedAt: report.generatedAt,
    riskScore,
    soc2,
    summary: report.summary,
    totalFindings: report.findings.length
  });
}
