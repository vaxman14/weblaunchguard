-- 0005: admin panel support
--   * is_admin flag on profiles (only set via service role / migration)
--   * manual_override flag on subscriptions (admin-assigned plans Stripe won't clobber)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT false;

-- Grant Roman admin access
UPDATE public.profiles SET is_admin = true WHERE email = 'vaxman14@gmail.com';
