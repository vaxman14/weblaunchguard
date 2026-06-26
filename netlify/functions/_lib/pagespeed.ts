// Google PageSpeed Insights (Lighthouse) integration.
// Calls the public PSI v5 API for mobile + desktop and returns the four
// Lighthouse category scores (0-100) plus core web vitals. Returns null when
// no API key is configured or the call fails — callers treat it as optional so
// the passive scan still works without it.

export type LighthouseStrategyScores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpSeconds: number | null;
  cls: number | null;
  tbtMs: number | null;
};

export type LighthouseScores = {
  mobile: LighthouseStrategyScores | null;
  desktop: LighthouseStrategyScores | null;
  fetchedAt: string;
};

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function pct(score: unknown): number | null {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function numericValue(audits: Record<string, any>, id: string): number | null {
  const v = audits?.[id]?.numericValue;
  return typeof v === "number" ? v : null;
}

async function runStrategyOnce(url: string, strategy: "mobile" | "desktop", key: string): Promise<LighthouseStrategyScores | null> {
  const params = new URLSearchParams({ url, strategy, key });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) params.append("category", c);
  const endpoint = `${PSI_ENDPOINT}?${params.toString()}`;
  const controller = new AbortController();
  // Uncached mobile lab runs routinely take 20-40s; give them room.
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const data: any = await res.json();
    const cats = data?.lighthouseResult?.categories ?? {};
    const audits = data?.lighthouseResult?.audits ?? {};
    const lcp = numericValue(audits, "largest-contentful-paint");
    const tbt = numericValue(audits, "total-blocking-time");
    return {
      performance: pct(cats["performance"]?.score),
      accessibility: pct(cats["accessibility"]?.score),
      bestPractices: pct(cats["best-practices"]?.score),
      seo: pct(cats["seo"]?.score),
      lcpSeconds: lcp != null ? Math.round((lcp / 1000) * 10) / 10 : null,
      cls: numericValue(audits, "cumulative-layout-shift"),
      tbtMs: tbt != null ? Math.round(tbt) : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runStrategy(url: string, strategy: "mobile" | "desktop", key: string): Promise<LighthouseStrategyScores | null> {
  // One retry: cold mobile renders flake. Second attempt usually hits PSI's warm cache.
  const first = await runStrategyOnce(url, strategy, key);
  if (first) return first;
  return runStrategyOnce(url, strategy, key);
}

export async function fetchLighthouse(url: string): Promise<LighthouseScores | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;
  const [mobile, desktop] = await Promise.all([
    runStrategy(url, "mobile", key),
    runStrategy(url, "desktop", key)
  ]);
  if (!mobile && !desktop) return null;
  return { mobile, desktop, fetchedAt: new Date().toISOString() };
}
