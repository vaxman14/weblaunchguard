import { LegalPage } from "./LegalPage";

type CookiePolicyPageProps = {
  onBack: () => void;
};

export function CookiePolicyPage({ onBack }: CookiePolicyPageProps) {
  return (
    <LegalPage title="Cookie Policy" updated="June 24, 2026" onBack={onBack}>
      <p>
        This Cookie Policy explains how Web Launch Guard, operated by CTF Designs, uses cookies and
        similar browser storage technologies. By using the Service you acknowledge this use.
      </p>

      <h2>1. What We Use (and Don't Use)</h2>
      <p>
        We use <strong>functional browser storage only</strong> — no advertising trackers, no third-party
        marketing pixels, no cross-site tracking. The specific items are:
      </p>

      <h2>2. Session & Authentication</h2>
      <ul>
        <li>
          <strong>Supabase session token</strong> (localStorage / session cookie) — stores your encrypted
          sign-in session so you stay logged in. Cleared on sign-out or session expiry. Required to use the
          Service.
        </li>
      </ul>

      <h2>3. Preferences</h2>
      <ul>
        <li>
          <strong>wlg_a11y</strong> (localStorage) — saves your accessibility preferences: text size, high
          contrast, reduce motion, dyslexia-friendly font. Never sent to our servers.
        </li>
        <li>
          <strong>wlg_cookie_ack</strong> (localStorage) — records that you have seen and accepted this
          cookie notice. Set once, no expiry.
        </li>
        <li>
          <strong>Theme preference</strong> (localStorage) — records your light/dark mode choice.
        </li>
      </ul>

      <h2>4. Analytics & Tracking</h2>
      <p>
        We currently do not use analytics cookies, advertising pixels, or any form of cross-site behavioral
        tracking. If this changes we will update this policy and provide notice before activating any such
        technology.
      </p>

      <h2>5. Third-Party Storage</h2>
      <ul>
        <li>
          <strong>Google</strong> may set cookies if you use "Continue with Google" for OAuth. Governed by{" "}
          <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">
            Google's Cookie Policy
          </a>.
        </li>
      </ul>

      <h2>6. Managing Cookies</h2>
      <p>
        You can clear browser local storage and cookies at any time through your browser settings. Note that
        clearing the session token will sign you out, and clearing preferences will reset your accessibility
        and theme settings. You can also use the built-in Accessibility widget to reset preferences without
        clearing all cookies.
      </p>

      <h2>7. Do Not Track</h2>
      <p>
        We honor browser Do Not Track (DNT) signals by default — we do not engage in cross-site behavioral
        tracking regardless of your DNT setting.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this policy if we introduce new technology. Material changes will be communicated
        via in-app notice before taking effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        CTF Designs · <a href="mailto:roman@ctfdesigns.com">roman@ctfdesigns.com</a>
      </p>
    </LegalPage>
  );
}
