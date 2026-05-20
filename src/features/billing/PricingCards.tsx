import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { createCheckoutSession, type BillingInterval, type Tier } from "../../lib/api";

type PricingCardsProps = {
  accessToken?: string | null;
  enableCheckout?: boolean;
};

type Plan = {
  cta: string;
  description: string;
  features: string[];
  monthlyPrice: number;
  annualPricePerMonth: number;
  name: string;
  tier: Tier;
  variant: "primary" | "secondary";
};

const plans: Plan[] = [
  {
    annualPricePerMonth: 19,
    cta: "Start Basic scan",
    description: "Per-domain SOC 2-aligned launch checks. Each subscription covers one verified domain.",
    features: [
      "1 verified domain per subscription",
      "5 passive scans per month",
      "SOC 2 Trust Services checklist",
      "Cookie + accessibility findings"
    ],
    monthlyPrice: 29,
    name: "Basic",
    tier: "basic",
    variant: "secondary"
  },
  {
    annualPricePerMonth: 99,
    cta: "Get AI review",
    description: "AI launch reviews and controlled live inspection across up to 3 domains.",
    features: [
      "Up to 3 verified domains",
      "20 scans per domain per month",
      "Guided AI launch review",
      "Controlled live inspection",
      "SOC 2 checklist included"
    ],
    monthlyPrice: 129,
    name: "Pro",
    tier: "pro",
    variant: "primary"
  },
  {
    annualPricePerMonth: 349,
    cta: "Scale to Enterprise",
    description: "Higher-volume reviews and broader domain coverage for SaaS platforms approaching audit.",
    features: [
      "Up to 10 verified domains",
      "50 scans per domain per month",
      "Everything in Pro",
      "SOC 2 checklist included"
    ],
    monthlyPrice: 399,
    name: "Enterprise",
    tier: "enterprise",
    variant: "secondary"
  }
];

export function PricingCards({ accessToken, enableCheckout = false }: PricingCardsProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(tier: Tier) {
    if (!enableCheckout) {
      return;
    }

    setError(null);
    setLoadingTier(tier);

    try {
      const session = await createCheckoutSession({ accessToken, interval, tier });
      window.location.assign(session.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-center gap-2 rounded-full border border-line bg-page p-1">
        <button
          aria-pressed={interval === "monthly"}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            interval === "monthly" ? "bg-ink text-page shadow-sm" : "text-muted hover:text-ink"
          }`}
          onClick={() => setInterval("monthly")}
          type="button"
        >
          Monthly
        </button>
        <button
          aria-pressed={interval === "annual"}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
            interval === "annual" ? "bg-ink text-page shadow-sm" : "text-muted hover:text-ink"
          }`}
          onClick={() => setInterval("annual")}
          type="button"
        >
          Annual
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = interval === "monthly" ? plan.monthlyPrice : plan.annualPricePerMonth;
          const detail =
            interval === "monthly"
              ? "billed monthly"
              : `$${plan.annualPricePerMonth * 12} billed annually`;
          const titleId = `${plan.tier}-title`;
          const disabled = !enableCheckout || loadingTier !== null;

          return (
            <Card aria-labelledby={titleId} className="flex h-full flex-col p-6" key={plan.tier}>
              <div className="flex flex-1 flex-col">
                <h3 className="text-xl font-semibold text-ink" id={titleId}>
                  {plan.name}
                </h3>
                <p className="mt-4 text-3xl font-semibold text-ink">${price}/mo</p>
                <p className="mt-2 text-sm font-semibold text-accent">{detail}</p>
                <p className="mt-4 text-sm leading-6 text-muted">{plan.description}</p>
                <ul className="mt-5 space-y-3 text-sm leading-6 text-ink">
                  {plan.features.map((feature) => (
                    <li className="flex gap-3" key={feature}>
                      <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                aria-disabled={disabled}
                className="mt-6 w-full"
                disabled={disabled}
                onClick={() => handleCheckout(plan.tier)}
                title={!enableCheckout ? "Sign in to start checkout." : undefined}
                variant={plan.variant}
              >
                {loadingTier === plan.tier ? "Opening checkout" : plan.cta}
              </Button>
            </Card>
          );
        })}
      </div>
      {!enableCheckout ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Sign in to choose a plan.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
