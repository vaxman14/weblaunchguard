import { LegalPage } from "./LegalPage";

type TermsPageProps = {
  onBack: () => void;
};

export function TermsPage({ onBack }: TermsPageProps) {
  return (
    <LegalPage title="Terms of Service" updated="May 20, 2026" onBack={onBack}>
      <p>
        These Terms of Service ("Terms") govern your access to and use of Web Launch Guard (the "Service"),
        operated by CTFDigital. By creating an account or using the Service, you agree to these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and have the legal authority to enter into a binding agreement.
        If you are using the Service on behalf of a business, you represent that you have authority to bind
        that business to these Terms.
      </p>

      <h2>2. Account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your credentials and for all activity
        under your account. Notify us immediately at{" "}
        <a href="mailto:support@ctfdigital.store">support@ctfdigital.store</a> if you suspect unauthorized
        access.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree that you will only scan domains:</p>
      <ul>
        <li>That you own, or</li>
        <li>For which you have explicit written authorization from the domain owner to perform security assessments.</li>
      </ul>
      <p>You must not use the Service to:</p>
      <ul>
        <li>Scan targets without authorization.</li>
        <li>Attempt to disrupt, degrade, or attack any third-party systems.</li>
        <li>Circumvent rate limits, quota controls, or access controls.</li>
        <li>Resell or sublicense the Service without written consent from CTFDigital.</li>
        <li>Violate any applicable law or regulation.</li>
      </ul>

      <h2>4. Billing & Subscriptions</h2>
      <p>
        Paid plans are billed monthly or annually in advance via Stripe. Subscriptions automatically renew
        unless cancelled before the renewal date. Refunds are not provided for partial billing periods.
        CTFDigital reserves the right to change pricing with 30 days' notice to registered users.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        Web Launch Guard and its underlying technology are owned by CTFDigital. These Terms grant you a
        limited, non-exclusive, non-transferable license to use the Service for your internal business
        purposes. You retain ownership of the domains and content you scan.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind, express or
        implied. Web Launch Guard is a passive scanning and advisory tool — findings are informational and
        do not constitute legal, security, or compliance advice. CTFDigital does not guarantee that the
        Service will detect all vulnerabilities or that any scan result is complete or accurate.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, CTFDigital's total liability for any claims arising out of
        or relating to the Service will not exceed the amount you paid to CTFDigital in the 12 months
        preceding the claim. CTFDigital is not liable for any indirect, incidental, special, consequential,
        or punitive damages.
      </p>

      <h2>8. Indemnification</h2>
      <p>
        You agree to indemnify and hold CTFDigital harmless from any claims, damages, or expenses arising
        from your use of the Service, your violation of these Terms, or your violation of any third-party
        rights.
      </p>

      <h2>9. Termination</h2>
      <p>
        Either party may terminate these Terms at any time. CTFDigital may suspend or terminate your
        account immediately if you violate these Terms. Upon termination, your right to use the Service
        ceases.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of California, USA, without regard to its conflict
        of law provisions. Disputes shall be resolved in the courts of San Diego County, California.
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these Terms. We will notify you of material changes via email or in-app notice.
        Continued use after the effective date constitutes acceptance.
      </p>

      <h2>12. Contact</h2>
      <p>
        CTFDigital · <a href="mailto:support@ctfdigital.store">support@ctfdigital.store</a>
      </p>
    </LegalPage>
  );
}
