-- 0008: public share tokens for reports.
-- A share_token allows anyone with the URL to read a report without auth.

alter table public.reports
  add column if not exists share_token uuid unique default null;

create index if not exists reports_share_token_idx
  on public.reports(share_token)
  where share_token is not null;
