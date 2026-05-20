import { LegalPage } from "./LegalPage";

type PrivacyPageProps = {
  onBack: () => void;
};

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <LegalPage title="Privacy Policy" updated="May 20, 2026" onBack={onBack}>
      <p>
        Web Launch Guard ("Service", "we", "us") is operated by CTFDigital. This Privacy Policy explains what
        information we collect, how we use it, and your rights regarding that information. By using the Service
        you agree to these practices.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account data.</strong> Your email address, collected when you sign up via email/password or
          Google OAuth.
        </li>
        <li>
          <strong>Billing data.</strong> Payment is processed by Stripe. We store only your Stripe customer ID
          and subscription status — we never see or store raw card numbers.
        </li>
        <li>
          <strong>Scan data.</strong> Domain names and URLs you submit for scanning, plus the findings and
          scores we generate from those scans.
        </li>
        <li>
          <strong>Usage data.</strong> Standard server logs including IP addresses, timestamps, and HTTP
          request metadata, used for security and abuse prevention.
        </li>
        <li>
          <strong>Preferences.</strong> Theme and accessibility settings stored in your browser's local
          storage. These never leave your device.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide and operate the Web Launch Guard scanning service.</li>
        <li>Process billing and manage your subscription via Stripe.</li>
        <li>Enforce scan quotas, rate limits, and acceptable use policies.</li>
        <li>Send transactional communications (e.g., billing confirmations). We do not send marketing email
          without your explicit opt-in.</li>
        <li>Maintain security, detect abuse, and comply with legal obligations.</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — database and authentication hosting (us-west-2).
        </li>
        <li>
          <strong>Stripe</strong> — payment processing. Governed by{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            Stripe's Privacy Policy
          </a>.
        </li>
        <li>
          <strong>Groq</strong> — AI-assisted analysis for Pro and Enterprise scans. Scan evidence is sent to
          Groq's API for processing. We do not send personal information to Groq.
        </li>
        <li>
          <strong>Netlify</strong> — serverless function and static site hosting.
        </li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We retain your account data for as long as your account is active. Scan reports are retained for 12
        months, after which they are archived or deleted. You may request deletion of your account and
        associated data by emailing{" "}
        <a href="mailto:privacy@ctfdigital.store">privacy@ctfdigital.store</a>.
      </p>

      <h2>5. Your Rights (CCPA / GDPR)</h2>
      <ul>
        <li>Request a copy of the personal data we hold about you.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of your data.</li>
        <li>Opt out of any marketing communications.</li>
        <li>For California residents: we do not sell your personal information.</li>
      </ul>
      <p>
        To exercise these rights, email{" "}
        <a href="mailto:privacy@ctfdigital.store">privacy@ctfdigital.store</a>.
      </p>

      <h2>6. Cookies & Local Storage</h2>
      <p>
        We use session cookies required for authentication and local storage for your preferences. See our{" "}
        <button
          className="text-accent underline"
          onClick={() => {
            window.location.hash = "cookies";
          }}
        >
          Cookie Policy
        </button>{" "}
        for details.
      </p>

      <h2>7. Security</h2>
      <p>
        All data is transmitted over HTTPS. Database access is restricted via row-level security policies.
        Service-role credentials are never exposed to the browser.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is not directed at children under 13. We do not knowingly collect data from children.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this policy. We will notify registered users of material changes by email or in-app
        notice. Continued use of the Service after changes constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        CTFDigital · <a href="mailto:privacy@ctfdigital.store">privacy@ctfdigital.store</a>
      </p>
    </LegalPage>
  );
}
