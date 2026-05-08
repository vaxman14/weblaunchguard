import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { createPortalSession } from "../../lib/api";

export type SubscriptionRow = {
  billing_interval: "monthly" | "annual" | null;
  current_period_end: string | null;
  current_period_start: string | null;
  id: string;
  status: string;
  stripe_customer_id: string | null;
  tier: "basic" | "pro" | "enterprise";
};

type BillingPanelProps = {
  accessToken?: string | null;
  subscriptions: SubscriptionRow[];
};

const tierLabel = { basic: "Basic", enterprise: "Enterprise", pro: "Pro" } as const;

export function BillingPanel({ accessToken, subscriptions }: BillingPanelProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCustomer = subscriptions.some((subscription) => subscription.stripe_customer_id);

  async function openPortal() {
    setError(null);
    setPortalLoading(true);

    try {
      const session = await createPortalSession({ accessToken });
      window.location.assign(session.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Billing portal could not be opened.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <Card aria-labelledby="billing-heading" className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-lg border border-line bg-page p-2 text-accent">
          <CreditCard aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-ink" id="billing-heading">
            Subscriptions
          </h2>
          <p className="mt-1 text-sm text-muted">
            Each Basic subscription covers one domain. Pro covers up to 3, Enterprise up to 10.
          </p>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <p className="rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
          No active subscriptions yet. Choose a plan below to get started.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Active subscriptions">
          {subscriptions.map((subscription) => (
            <li
              className="flex flex-col gap-2 rounded-lg border border-line bg-page p-3 sm:flex-row sm:items-center sm:justify-between"
              key={subscription.id}
            >
              <div>
                <p className="text-sm font-semibold text-ink">
                  {tierLabel[subscription.tier]} ({subscription.billing_interval ?? "monthly"})
                </p>
                <p className="mt-1 text-xs text-muted">
                  Status: {subscription.status}
                  {subscription.current_period_end
                    ? ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button disabled={!hasCustomer || portalLoading} onClick={openPortal} variant="ghost">
          {portalLoading ? "Opening" : "Manage billing"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
