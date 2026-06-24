import type { Tier } from "./api";

export type TierConfig = {
  aiEnabled: boolean;
  annualPricePerMonth: number;
  label: string;
  maxDomains: number;
  monthlyPrice: number;
  runsPerDomainPerPeriod: number;
};

export const tierConfig: Record<Tier, TierConfig> = {
  basic: {
    aiEnabled: false,
    annualPricePerMonth: 19,
    label: "Basic",
    maxDomains: 1,
    monthlyPrice: 29,
    runsPerDomainPerPeriod: 5
  },
  pro: {
    aiEnabled: true,
    annualPricePerMonth: 99,
    label: "Pro",
    maxDomains: 3,
    monthlyPrice: 129,
    runsPerDomainPerPeriod: 20
  },
  // Free-tool comp tier every account gets (see netlify/functions/_lib/tiers.ts).
  enterprise: {
    aiEnabled: true,
    annualPricePerMonth: 0,
    label: "Free",
    maxDomains: 5,
    monthlyPrice: 0,
    runsPerDomainPerPeriod: 25
  }
};
