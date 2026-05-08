export type Tier = "basic" | "pro" | "enterprise";
export type BillingInterval = "monthly" | "annual";

export type TierConfig = {
  aiEnabled: boolean;
  label: string;
  maxDomains: number;
  monthlyPriceUsd: number;
  monthlyPriceEnv: string;
  annualPriceUsdPerMonth: number;
  annualPriceEnv: string;
  runsPerDomainPerPeriod: number;
};

export const tierConfig: Record<Tier, TierConfig> = {
  basic: {
    aiEnabled: false,
    label: "Basic",
    maxDomains: 1,
    monthlyPriceUsd: 29,
    monthlyPriceEnv: "STRIPE_BASIC_MONTHLY_PRICE_ID",
    annualPriceUsdPerMonth: 19,
    annualPriceEnv: "STRIPE_BASIC_ANNUAL_PRICE_ID",
    runsPerDomainPerPeriod: 5
  },
  pro: {
    aiEnabled: true,
    label: "Pro",
    maxDomains: 3,
    monthlyPriceUsd: 129,
    monthlyPriceEnv: "STRIPE_PRO_MONTHLY_PRICE_ID",
    annualPriceUsdPerMonth: 99,
    annualPriceEnv: "STRIPE_PRO_ANNUAL_PRICE_ID",
    runsPerDomainPerPeriod: 20
  },
  enterprise: {
    aiEnabled: true,
    label: "Enterprise",
    maxDomains: 10,
    monthlyPriceUsd: 399,
    monthlyPriceEnv: "STRIPE_ENTERPRISE_MONTHLY_PRICE_ID",
    annualPriceUsdPerMonth: 349,
    annualPriceEnv: "STRIPE_ENTERPRISE_ANNUAL_PRICE_ID",
    runsPerDomainPerPeriod: 50
  }
};

export function tierFromString(value: unknown): Tier | null {
  return value === "basic" || value === "pro" || value === "enterprise" ? value : null;
}

export function billingIntervalFromString(value: unknown): BillingInterval | null {
  return value === "monthly" || value === "annual" ? value : null;
}

export function priceIdForTier(tier: Tier, interval: BillingInterval): string {
  const config = tierConfig[tier];
  const envName = interval === "monthly" ? config.monthlyPriceEnv : config.annualPriceEnv;
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`Missing ${envName}.`);
  }

  return value;
}

export function priceIdToTierAndInterval(priceId: string): { tier: Tier; interval: BillingInterval } | null {
  for (const tier of Object.keys(tierConfig) as Tier[]) {
    const config = tierConfig[tier];
    if (process.env[config.monthlyPriceEnv]?.trim() === priceId) {
      return { interval: "monthly", tier };
    }

    if (process.env[config.annualPriceEnv]?.trim() === priceId) {
      return { interval: "annual", tier };
    }
  }

  return null;
}
