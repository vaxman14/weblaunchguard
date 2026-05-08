alter table public.subscriptions
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column stripe_price_id text,
  add column billing_interval text;

alter table public.subscriptions
  drop constraint subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (
    status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  add constraint subscriptions_billing_interval_check check (
    billing_interval is null or billing_interval in ('monthly', 'annual')
  );

create unique index subscriptions_stripe_customer_id_idx
  on public.subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index subscriptions_stripe_subscription_id_idx
  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;
