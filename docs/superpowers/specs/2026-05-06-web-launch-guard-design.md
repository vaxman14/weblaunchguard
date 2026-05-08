# Web Launch Guard Design

Date: 2026-05-06
Company: CTFDigital
Company website: https://ctfdigital.store
Product domain: https://weblaunchguard.com

## Overview

Web Launch Guard is a SaaS security-check product for SaaS founders and teams. It lets signed-in users scan public URLs, understand common launch/security risks, and export private reports.

The MVP will be a polished, working SaaS application hosted on Netlify, backed by Supabase, and monetized with Stripe. Free users get safe passive checks with a limited report. Pro users get DNS-verified domain workflows and AI-assisted deeper review modes powered by the OpenAI API once `OPENAI_API_KEY` is configured.

## Goals

- Provide a clear public homepage with visible pricing.
- Require sign-up before scanning.
- Support email/password and Google sign-in through Supabase.
- Give Free users passive security checks with up to 5 insights per report.
- Offer Pro at $99/month or $79/month billed annually.
- Require DNS TXT ownership verification before Pro active testing.
- Offer two Pro testing modes: Guided AI Review and Controlled Live Inspection.
- Keep reports private by default.
- Allow report export to PDF.
- Include ADA-conscious UI, light/dark/system themes, and a functional cookie banner.
- Use Supabase, Netlify, Stripe, and server-side OpenAI integration.

## Non-Goals

- No destructive security testing.
- No exploit payloads, brute force, credential stuffing, spam, or bypass attempts.
- No public report sharing in the MVP.
- No team workspaces in the MVP.
- No browser-stored OpenAI, Stripe, or Supabase service secrets.

## Plans And Access

### Base / Free

- Requires authenticated account.
- Can scan public URLs using passive checks.
- Shows up to 5 insights per report.
- Can view private reports and export to PDF.
- Sees upgrade prompts for Pro-only findings and active modes.

### Pro

- Available as monthly or annual Stripe subscription.
- Monthly price: $99/month.
- Annual price: $79/month billed annually.
- Unlocks domain verification.
- Unlocks Guided AI Review for verified domains.
- Unlocks Controlled Live Inspection for verified domains.
- Uses OpenAI server-side for deeper report generation.

## Product Structure

### Public Homepage

The homepage will present Web Launch Guard as a launch/security readiness tool for SaaS websites. It will include:

- Product name and value proposition.
- Clear scan/security positioning.
- Pricing cards for Free and Pro.
- Sign-up and login calls to action.
- ADA/accessibility-conscious implementation.
- Functional cookie banner.
- Light, dark, and system theme controls.
- Footer referencing CTFDigital and https://ctfdigital.store.

### Auth

Supabase Auth will provide:

- Email/password sign-up and login.
- Google OAuth sign-in.
- Session handling.
- User identity for row-level security.

### Dashboard

The authenticated dashboard will include:

- URL scan entry.
- Recent reports.
- Current plan status.
- Verified domains.
- Billing controls.
- Upgrade prompts.
- Settings access.

### Domain Verification

For active Pro testing, users must verify domain ownership:

1. User submits a domain.
2. App generates a unique DNS TXT value, such as `weblaunchguard-verify=wlguard_<token>`.
3. User adds the TXT value to DNS.
4. App checks DNS for the value.
5. Supabase stores the verification status.
6. Active Pro modes unlock only for verified domains owned by the user.

## Scanning Behavior

### Passive Checks

Passive checks are safe public checks that make minimal requests and inspect security signals:

- HTTPS availability and redirect behavior.
- TLS/certificate status where available.
- Security headers, including CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, and related headers.
- Cookie flags from response headers.
- Mixed-content hints from public HTML.
- Public forms and insecure form actions.
- Basic exposed metadata.
- robots.txt and sitemap presence.
- Accessibility basics, including labels, contrast hints, document language, headings, and alt text signals.

### Guided AI Review

Guided AI Review is the lowest-impact Pro option. It uses passive scan evidence and optional user-provided context to generate a deeper prioritized security report. It is best for early-stage SaaS teams, production apps, or users who want low/no traffic impact.

### Controlled Live Inspection

Controlled Live Inspection is the deeper Pro option. It makes safe additional HTTP requests to same-domain pages, forms, links, cookies, routes, and responses, then uses the OpenAI API to prioritize findings. It is best for users who own the app and want stronger evidence.

Controlled Live Inspection must avoid destructive actions, exploit payloads, brute force, credential stuffing, spam, bypass attempts, and any authenticated testing unless explicitly designed in a later version.

## Reports

Reports will be private to the signed-in user by default. A report will include:

- Target URL and domain.
- Scan type.
- Plan context.
- Risk score.
- Findings grouped by severity.
- Evidence for each finding.
- Recommended remediation.
- Free-plan insight limit where applicable.
- PDF export action.

Public share links are out of scope for the MVP.

## Data Model

Supabase will store:

- User profiles.
- Personal workspace records.
- Domains.
- DNS verification tokens and statuses.
- Scan jobs.
- Reports.
- Findings.
- Stripe customer and subscription state.
- Cookie/theme preferences when appropriate.

Row-level security must ensure each user only sees their own records.

## Integrations

### Supabase

Supabase provides auth, database storage, and row-level security. Google sign-in will be configured through Supabase OAuth.

### Netlify

Netlify hosts the frontend and serverless functions. Functions will handle:

- Passive scan execution.
- Domain verification checks.
- Stripe checkout and billing portal creation.
- Stripe webhook handling.
- OpenAI Pro report generation.
- PDF export.

### Stripe

Stripe handles:

- Monthly Pro checkout.
- Annual Pro checkout.
- Customer portal.
- Webhooks to mirror subscription status into Supabase.

### OpenAI

OpenAI is used server-side only:

- API key stored in `OPENAI_API_KEY`.
- No key exposed in the browser.
- Used only for Pro report generation after plan and domain checks pass.
- Missing-key errors must be handled clearly in the app.

## Accessibility And Compliance

The UI will be ADA-conscious and include:

- Semantic HTML.
- Keyboard navigation.
- Visible focus states.
- Proper labels and form errors.
- Contrast-safe light and dark themes.
- System theme support.
- Reduced-motion-friendly styling.
- Clear scan consent language.
- Functional cookie banner for essential preferences.

The cookie banner will not introduce marketing cookies by default. It will store functional consent and preferences only.

## Error Handling

The app will handle:

- Invalid URLs.
- Blocked or unreachable targets.
- Failed DNS verification.
- Missing or inactive subscription.
- Stripe checkout and webhook errors.
- Missing OpenAI API key.
- OpenAI request failures.
- PDF export failures.
- Supabase auth/session failures.

Errors should be plain-language, actionable, and accessible.

## Testing Strategy

Testing should cover:

- Homepage rendering and pricing.
- Auth-gated dashboard routes.
- Passive scan happy path and failure path.
- Free-plan insight limiting.
- DNS TXT verification flow.
- Pro plan gating.
- Guided AI Review and Controlled Live Inspection UI states.
- Stripe checkout and webhook handlers with test fixtures.
- PDF export generation.
- Theme switching.
- Cookie banner persistence.
- Keyboard accessibility and focus behavior.

## Implementation Approach

The MVP should be implemented as a polished working SaaS app first. Scanner depth, compliance features, and team workflows can expand after the core product is usable.

The implementation should keep server-only operations in Netlify functions, keep secrets out of the browser, and keep the scan engine separated from UI components so additional checks can be added safely later.
