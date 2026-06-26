import { writeFileSync } from "node:fs";
import { validateTargetUrl } from "./netlify/functions/_lib/network";
import { analyzePassive, describeFetchError, fetchWithGuards } from "./netlify/functions/_lib/scan-engine";
import { calculateRiskScore } from "./netlify/functions/_lib/reports";
import { generateSoc2Checklist } from "./netlify/functions/_lib/soc2";

async function main() {
  const raw = process.argv[2];
  const target = validateTargetUrl(raw);
  let response;
  try {
    response = await fetchWithGuards(target);
  } catch (err) {
    const { message, status } = describeFetchError(err);
    console.error(`FETCH ERROR (${status}): ${message}`);
    process.exit(1);
  }
  const report = analyzePassive({
    finalUrl: response.finalUrl,
    headers: response.headers,
    html: response.body,
    htmlTruncated: response.htmlTruncated,
    initialUrl: target.toString(),
    status: response.status
  });
  const riskScore = calculateRiskScore(report.findings);
  const soc2 = generateSoc2Checklist(report.findings);
  const out = {
    initialUrl: target.toString(),
    finalUrl: report.finalUrl,
    status: report.status,
    generatedAt: report.generatedAt,
    summary: report.summary,
    riskScore,
    totalFindings: report.findings.length,
    findings: report.findings,
    soc2
  };
  writeFileSync("/tmp/wlg-scan.json", JSON.stringify(out, null, 2));
  const bySev: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const f of report.findings) bySev[f.severity]++;
  console.log(`OK ${report.finalUrl} | score=${riskScore} | findings=${report.findings.length} (high=${bySev.high} med=${bySev.medium} low=${bySev.low})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
