import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  billingIntervalFromString,
  priceIdForTier,
  priceIdToTierAndInterval,
  tierFromString
} from "../netlify/functions/_lib/tiers";

const envSnapshot: Record<string, string | undefined> = {};
const keys = [
  "STRIPE_BASIC_MONTHLY_PRICE_ID",
  "STRIPE_BASIC_ANNUAL_PRICE_ID",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_ANNUAL_PRICE_ID",
  "STRIPE_ENTERPRISE_MONTHLY_PRICE_ID",
  "STRIPE_ENTERPRISE_ANNUAL_PRICE_ID"
];

beforeEach(() => {
  for (const key of keys) {
    envSnapshot[key] = process.env[key];
  }

  process.env.STRIPE_BASIC_MONTHLY_PRICE_ID = "price_basic_m";
  process.env.STRIPE_BASIC_ANNUAL_PRICE_ID = "price_basic_y";
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_m";
  process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_pro_y";
  process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID = "price_ent_m";
  process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID = "price_ent_y";
});

afterEach(() => {
  for (const key of keys) {
    if (envSnapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envSnapshot[key];
    }
  }
});

describe("tier helpers", () => {
  test("validates tier and interval input strings", () => {
    expect(tierFromString("basic")).toBe("basic");
    expect(tierFromString("pro")).toBe("pro");
    expect(tierFromString("enterprise")).toBe("enterprise");
    expect(tierFromString("free")).toBeNull();
    expect(billingIntervalFromString("monthly")).toBe("monthly");
    expect(billingIntervalFromString("annual")).toBe("annual");
    expect(billingIntervalFromString("yearly")).toBeNull();
  });

  test("looks up the configured price id for each tier and interval", () => {
    expect(priceIdForTier("basic", "monthly")).toBe("price_basic_m");
    expect(priceIdForTier("basic", "annual")).toBe("price_basic_y");
    expect(priceIdForTier("pro", "monthly")).toBe("price_pro_m");
    expect(priceIdForTier("pro", "annual")).toBe("price_pro_y");
    expect(priceIdForTier("enterprise", "monthly")).toBe("price_ent_m");
    expect(priceIdForTier("enterprise", "annual")).toBe("price_ent_y");
  });

  test("throws when a price id is not configured", () => {
    delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    expect(() => priceIdForTier("pro", "monthly")).toThrow(/STRIPE_PRO_MONTHLY_PRICE_ID/);
  });

  test("reverses a price id back into the tier and interval", () => {
    expect(priceIdToTierAndInterval("price_pro_y")).toEqual({ interval: "annual", tier: "pro" });
    expect(priceIdToTierAndInterval("price_basic_m")).toEqual({ interval: "monthly", tier: "basic" });
    expect(priceIdToTierAndInterval("price_ent_m")).toEqual({ interval: "monthly", tier: "enterprise" });
    expect(priceIdToTierAndInterval("price_unknown")).toBeNull();
  });
});
