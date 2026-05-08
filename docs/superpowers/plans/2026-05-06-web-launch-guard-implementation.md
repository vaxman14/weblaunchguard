# Web Launch Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished SaaS MVP for Web Launch Guard with auth, dashboard, passive scans, DNS verification, Pro AI scan modes, Stripe billing gates, PDF export, ADA-conscious UI, and Netlify/Supabase deployment structure.

**Architecture:** Use a React + TypeScript Vite frontend hosted on Netlify, with Netlify Functions for server-side scanning, DNS checks, Stripe, PDF generation, and OpenAI report generation. Supabase owns auth, database, row-level security, and subscription/report records. Browser code never receives service-role, Stripe secret, or OpenAI keys.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, lucide-react, Supabase JS, Netlify Functions, Stripe SDK, OpenAI SDK, Playwright, Vitest, Testing Library, axe-core.

---

## File Structure

- `package.json`: scripts, dependencies, test commands.
- `vite.config.ts`: Vite and Vitest configuration.
- `tailwind.config.ts`: Tailwind theme tokens.
- `postcss.config.js`: Tailwind processing.
- `netlify.toml`: Netlify build/functions configuration.
- `.env.example`: required environment variable names only.
- `index.html`: app shell.
- `src/main.tsx`: React entry.
- `src/App.tsx`: top-level routing and providers.
- `src/styles/globals.css`: base styles, focus states, themes.
- `src/lib/env.ts`: browser-safe environment validation.
- `src/lib/supabase.ts`: Supabase client.
- `src/lib/types.ts`: shared frontend types.
- `src/lib/api.ts`: typed frontend calls to Netlify Functions.
- `src/lib/theme.tsx`: light/dark/system theme provider.
- `src/lib/auth.tsx`: auth provider and session handling.
- `src/components/*`: reusable UI components.
- `src/pages/HomePage.tsx`: public homepage and pricing.
- `src/pages/AuthPage.tsx`: email/password and Google auth.
- `src/pages/DashboardPage.tsx`: authenticated dashboard shell.
- `src/pages/ReportPage.tsx`: report detail and PDF export.
- `src/pages/SettingsPage.tsx`: profile, theme, billing, verified domains.
- `src/features/scans/*`: scan form, mode selector, report cards, findings.
- `src/features/domains/*`: DNS verification UI.
- `src/features/billing/*`: pricing cards and billing controls.
- `src/features/cookies/*`: functional cookie banner.
- `netlify/functions/_lib/*`: shared server helpers.
- `netlify/functions/passive-scan.ts`: passive scanner endpoint.
- `netlify/functions/verify-domain.ts`: DNS TXT verification endpoint.
- `netlify/functions/create-checkout.ts`: Stripe checkout endpoint.
- `netlify/functions/create-portal.ts`: Stripe portal endpoint.
- `netlify/functions/stripe-webhook.ts`: Stripe webhook endpoint.
- `netlify/functions/pro-analysis.ts`: OpenAI Pro analysis endpoint.
- `netlify/functions/export-report.ts`: PDF export endpoint.
- `supabase/migrations/0001_initial_schema.sql`: tables, indexes, RLS policies.
- `tests/*`: unit and accessibility tests.
- `e2e/*`: Playwright smoke tests.

---

### Task 1: Scaffold The App

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `netlify.toml`
- Create: `.env.example`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/globals.css`

- [ ] **Step 1: Create project configuration**

Create `package.json` with these scripts and dependencies:

```json
{
  "name": "web-launch-guard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "lint": "eslint . --ext ts,tsx --max-warnings 0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "openai": "^4.77.0",
    "stripe": "^17.5.0",
    "zod": "^3.24.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create Vite, TypeScript, Tailwind, and Netlify config**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"]
  }
});
```

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Create `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
OPENAI_API_KEY=
URL=http://localhost:8888
```

- [ ] **Step 3: Create the minimal React shell**

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-page text-ink">
      <h1>Web Launch Guard</h1>
    </main>
  );
}
```

- [ ] **Step 4: Install and verify**

Run: `npm install`

Expected: dependencies install without errors.

Run: `npm run build`

Expected: Vite builds `dist` successfully.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js netlify.toml .env.example index.html src
git commit -m "chore: scaffold web launch guard app"
```

---

### Task 2: Add Theme, Cookie Banner, And Core UI

**Files:**
- Create: `src/lib/theme.tsx`
- Create: `src/components/Button.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/components/ThemeToggle.tsx`
- Create: `src/features/cookies/CookieBanner.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/theme-cookie.test.tsx`

- [ ] **Step 1: Write tests for theme and cookie persistence**

Create `tests/theme-cookie.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

test("shows functional cookie banner until accepted", async () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByText(/functional cookies/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /accept/i }));
  expect(screen.queryByText(/functional cookies/i)).not.toBeInTheDocument();
  expect(localStorage.getItem("wlg_cookie_ack")).toBe("true");
});

test("theme toggle cycles light dark and system", async () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: /theme/i });
  await userEvent.click(toggle);
  expect(localStorage.getItem("wlg_theme")).toBe("dark");
  await userEvent.click(toggle);
  expect(localStorage.getItem("wlg_theme")).toBe("system");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/theme-cookie.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement theme provider and cookie banner**

Create `src/lib/theme.tsx` with a context that stores `light`, `dark`, or `system` in `localStorage` under `wlg_theme`, applies `data-theme` to `document.documentElement`, and exposes `theme` and `cycleTheme`.

Create `src/features/cookies/CookieBanner.tsx` that reads `wlg_cookie_ack`, shows a bottom banner explaining functional cookies for theme/session preferences, and stores `true` when accepted.

- [ ] **Step 4: Add reusable UI components**

Create `Button`, `Card`, and `ThemeToggle` components with keyboard-safe buttons, visible focus rings, and lucide icons in icon-only or icon-plus-label controls.

- [ ] **Step 5: Wire providers into `App.tsx`**

Wrap the app with `ThemeProvider`, render `ThemeToggle`, and render `CookieBanner`.

- [ ] **Step 6: Verify**

Run: `npm test -- tests/theme-cookie.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src tests
git commit -m "feat: add theme and cookie preferences"
```

---

### Task 3: Build Public Homepage And Pricing

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/features/billing/PricingCards.tsx`
- Modify: `src/App.tsx`
- Test: `tests/homepage.test.tsx`

- [ ] **Step 1: Write homepage tests**

Create `tests/homepage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "../src/App";

test("renders Web Launch Guard homepage with pricing", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /web launch guard/i })).toBeInTheDocument();
  expect(screen.getByText(/ctfdigital/i)).toBeInTheDocument();
  expect(screen.getByText(/\$99\/month/i)).toBeInTheDocument();
  expect(screen.getByText(/\$79\/month billed annually/i)).toBeInTheDocument();
  expect(screen.getByText(/5 passive insights/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/homepage.test.tsx`

Expected: FAIL because the homepage is not implemented.

- [ ] **Step 3: Implement `PricingCards`**

Create two pricing cards:

- Base: Free, 5 passive insights, private reports, PDF export.
- Pro: $99/month or $79/month billed annually, DNS verification, Guided AI Review, Controlled Live Inspection.

- [ ] **Step 4: Implement `HomePage`**

Use restrained SaaS styling, real app CTAs, pricing visible in the first scroll, accessibility statement, and footer text: `Operated by CTFDigital`.

- [ ] **Step 5: Verify**

Run: `npm test -- tests/homepage.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src tests
git commit -m "feat: build public homepage and pricing"
```

---

### Task 4: Add Supabase Schema And Auth UI

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/auth.tsx`
- Create: `src/pages/AuthPage.tsx`
- Modify: `src/App.tsx`
- Test: `tests/auth.test.tsx`

- [ ] **Step 1: Create Supabase schema**

Create tables: `profiles`, `workspaces`, `domains`, `scan_jobs`, `reports`, `findings`, `subscriptions`. Enable RLS on all user-owned tables. Add policies scoped to `auth.uid()`.

- [ ] **Step 2: Create environment and Supabase clients**

Create `env.ts` that reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, returning empty dev-safe values only during tests.

Create `supabase.ts` using `createClient`.

- [ ] **Step 3: Create AuthProvider**

Track session, loading state, and expose `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, and `signOut`.

- [ ] **Step 4: Create auth page**

Build an accessible form with email, password, sign up, sign in, and Google sign-in button.

- [ ] **Step 5: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add supabase src tests
git commit -m "feat: add supabase auth foundation"
```

---

### Task 5: Build Dashboard And Passive Scanner

**Files:**
- Create: `src/pages/DashboardPage.tsx`
- Create: `src/features/scans/ScanForm.tsx`
- Create: `src/features/scans/FindingList.tsx`
- Create: `src/lib/api.ts`
- Create: `netlify/functions/_lib/http.ts`
- Create: `netlify/functions/passive-scan.ts`
- Test: `tests/passive-scan.test.ts`
- Test: `tests/dashboard.test.tsx`

- [ ] **Step 1: Write passive scanner unit tests**

Test that a response with missing HSTS, missing CSP, insecure cookies, and no document language produces findings with severity and remediation.

- [ ] **Step 2: Implement passive scanner function**

Validate URL protocol, fetch with timeout, inspect headers and HTML, return a report payload with no more than 5 findings for Free users.

- [ ] **Step 3: Build dashboard scan UI**

Add URL input, plan badge, scan button, loading state, error state, and finding list.

- [ ] **Step 4: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src netlify tests
git commit -m "feat: add dashboard passive scans"
```

---

### Task 6: Add Domain Verification

**Files:**
- Create: `src/features/domains/DomainVerificationPanel.tsx`
- Create: `netlify/functions/verify-domain.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Test: `tests/domain-verification.test.ts`

- [ ] **Step 1: Write DNS verification tests**

Test that `_weblaunchguard.example.com` or the apex domain containing `weblaunchguard-verify=wlguard_test` returns verified.

- [ ] **Step 2: Implement verification endpoint**

Use Node DNS promises to resolve TXT records, compare against the stored token, and return `verified: true` only for an exact match.

- [ ] **Step 3: Build verification UI**

Show generated TXT record, copy action, check status button, success state, and failure guidance.

- [ ] **Step 4: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src netlify tests
git commit -m "feat: add dns domain verification"
```

---

### Task 7: Add Stripe Billing Gates

**Files:**
- Create: `netlify/functions/create-checkout.ts`
- Create: `netlify/functions/create-portal.ts`
- Create: `netlify/functions/stripe-webhook.ts`
- Create: `src/features/billing/BillingPanel.tsx`
- Modify: `src/features/billing/PricingCards.tsx`
- Test: `tests/billing.test.ts`

- [ ] **Step 1: Write billing tests**

Test monthly checkout uses `STRIPE_PRO_MONTHLY_PRICE_ID`, annual checkout uses `STRIPE_PRO_ANNUAL_PRICE_ID`, and webhook events update subscription status.

- [ ] **Step 2: Implement checkout and portal functions**

Create Stripe Checkout sessions and Billing Portal sessions server-side. Read price IDs and secrets from environment variables.

- [ ] **Step 3: Implement webhook function**

Verify Stripe signatures with `STRIPE_WEBHOOK_SECRET` and mirror active, trialing, past_due, canceled, and unpaid states into Supabase.

- [ ] **Step 4: Gate Pro UI**

Show Pro mode selector only when subscription status is active and domain is verified. Show upgrade CTA otherwise.

- [ ] **Step 5: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src netlify tests
git commit -m "feat: add stripe billing gates"
```

---

### Task 8: Add Pro AI Analysis Modes

**Files:**
- Create: `src/features/scans/ProModeSelector.tsx`
- Create: `netlify/functions/pro-analysis.ts`
- Create: `netlify/functions/_lib/openai.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Test: `tests/pro-analysis.test.ts`

- [ ] **Step 1: Write Pro analysis tests**

Test that unverified domains are rejected, inactive subscriptions are rejected, missing `OPENAI_API_KEY` returns a clear setup error, and verified Pro requests return AI findings.

- [ ] **Step 2: Implement mode selector**

Add Guided AI Review and Controlled Live Inspection choices with concise explanations and best-for guidance.

- [ ] **Step 3: Implement OpenAI helper**

Create a server-only helper that instantiates the OpenAI client from `OPENAI_API_KEY` and returns a typed setup error when absent.

- [ ] **Step 4: Implement Pro endpoint**

For Guided AI Review, send passive findings plus user context to OpenAI.

For Controlled Live Inspection, make safe same-domain GET/HEAD requests to discovered links, collect headers/forms/cookies evidence, and send that evidence to OpenAI.

- [ ] **Step 5: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src netlify tests
git commit -m "feat: add pro ai analysis modes"
```

---

### Task 9: Add Private Reports And PDF Export

**Files:**
- Create: `src/pages/ReportPage.tsx`
- Create: `netlify/functions/export-report.ts`
- Modify: `src/features/scans/FindingList.tsx`
- Test: `tests/report-export.test.ts`

- [ ] **Step 1: Write report tests**

Test report detail renders risk score, severity groups, evidence, remediation, and an export button.

- [ ] **Step 2: Implement report page**

Read report data owned by the signed-in user. Show findings grouped by severity. Keep the page private behind auth.

- [ ] **Step 3: Implement PDF export function**

Generate a clean HTML-to-PDF response or printable PDF payload containing report metadata, findings, and CTFDigital/Web Launch Guard branding.

- [ ] **Step 4: Verify**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src netlify tests
git commit -m "feat: add private reports and pdf export"
```

---

### Task 10: Accessibility, Error States, And Browser Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Create: `tests/accessibility.test.tsx`
- Modify: `src/styles/globals.css`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add accessibility tests**

Test homepage and dashboard for labeled controls, visible focus styles, heading order, and no obvious axe violations.

- [ ] **Step 2: Add Playwright smoke test**

Test homepage loads, pricing is visible, theme toggle works, cookie banner accepts, and auth page is reachable.

- [ ] **Step 3: Polish all error states**

Ensure invalid URLs, unreachable targets, DNS verification failure, missing subscription, missing OpenAI key, Stripe failure, and PDF export failure show clear accessible messages.

- [ ] **Step 4: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npm run dev`

Expected: local app starts and can be opened in the browser.

- [ ] **Step 5: Commit**

Run:

```bash
git add src tests e2e playwright.config.ts
git commit -m "test: add accessibility and smoke coverage"
```

---

## Self-Review

Spec coverage:

- Name, domain, CTFDigital, and public homepage are covered in Tasks 1 and 3.
- Auth with email/password and Google is covered in Task 4.
- Personal workspace and Supabase data ownership are covered in Task 4.
- Passive free scans and 5-insight limit are covered in Task 5.
- DNS TXT verification is covered in Task 6.
- Stripe monthly and annual Pro plans are covered in Task 7.
- Guided AI Review and Controlled Live Inspection are covered in Task 8.
- Private reports and PDF export are covered in Task 9.
- ADA-conscious UI, cookie banner, and theme modes are covered in Tasks 2 and 10.
- Netlify serverless boundaries and secret handling are covered across Tasks 5 through 9.

Red-flag scan:

- The plan uses concrete files, commands, and acceptance checks.

Type consistency:

- Frontend features call Netlify Functions through `src/lib/api.ts`.
- Server-only integrations live under `netlify/functions`.
- Shared UI remains under `src/components`.
- Feature-specific UI remains under `src/features`.
