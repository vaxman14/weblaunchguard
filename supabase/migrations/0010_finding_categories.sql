-- 0010: broaden findings.category to cover the expanded scan engine
-- (SEO, performance, conversion, best-practices) so authed scans can persist
-- these findings. Without this, the category check constraint rejects the
-- whole findings insert and the saved report shows no findings.

alter table public.findings
  drop constraint if exists findings_category_check;

alter table public.findings
  add constraint findings_category_check check (
    category in (
      'transport',
      'security-headers',
      'privacy-headers',
      'cookies',
      'accessibility',
      'seo',
      'performance',
      'conversion',
      'best-practices',
      'soc2',
      'ai-review',
      'controlled-inspection',
      'general'
    )
  );
