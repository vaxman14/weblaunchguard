import { LegalPage } from "./LegalPage";

type EulaPageProps = {
  onBack: () => void;
};

export function EulaPage({ onBack }: EulaPageProps) {
  return (
    <LegalPage title="End User License Agreement (EULA)" updated="June 24, 2026" onBack={onBack}>
      <p>
        This End User License Agreement ("EULA") is a legal agreement between you ("User") and CTF Designs
        ("Company") for the use of Web Launch Guard software and services (collectively, the "Software").
        By accessing or using the Software, you agree to be bound by this EULA.
      </p>

      <h2>1. License Grant</h2>
      <p>
        Subject to the terms of this EULA, CTF Designs grants you a limited, non-exclusive, non-transferable,
        revocable license to access and use the Software free of charge for your own lawful purposes. The
        Software is provided as a free tool; no fee or subscription is required or implied.
      </p>

      <h2>2. Restrictions</h2>
      <p>You may not:</p>
      <ul>
        <li>Copy, modify, or create derivative works of the Software.</li>
        <li>Reverse engineer, decompile, or disassemble any component of the Software.</li>
        <li>Sublicense, sell, rent, lease, transfer, or assign the Software or your rights therein.</li>
        <li>Use the Software to develop a competing product or service.</li>
        <li>Remove or alter any proprietary notices or labels on the Software.</li>
        <li>Use the Software in any way that violates applicable law or regulation.</li>
      </ul>

      <h2>3. Ownership</h2>
      <p>
        The Software is licensed, not sold. CTF Designs retains all right, title, and interest in and to the
        Software, including all intellectual property rights. You do not acquire any ownership rights by
        using the Software.
      </p>

      <h2>4. Updates and Modifications</h2>
      <p>
        CTF Designs may update, modify, or discontinue the Software at any time without notice. Updates may
        be subject to additional terms. Continued use of the Software after updates constitutes acceptance
        of any changes.
      </p>

      <h2>5. Disclaimer of Warranties</h2>
      <p>
        THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY
        LAW, CTF DESIGNS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. CTF DESIGNS DOES NOT
        WARRANT THAT THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF SECURITY VULNERABILITIES.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        IN NO EVENT SHALL CTF DESIGNS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
        CONSEQUENTIAL DAMAGES ARISING OUT OF OR IN CONNECTION WITH THIS EULA OR THE SOFTWARE. BECAUSE THE
        SOFTWARE IS PROVIDED FREE OF CHARGE, CTF DESIGNS' TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED ONE
        HUNDRED U.S. DOLLARS (US $100).
      </p>

      <h2>7. Term and Termination</h2>
      <p>
        This EULA is effective from the date you first use the Software and continues until you stop using
        it or your access is terminated. CTF Designs may terminate this EULA immediately if you breach any
        term. Upon termination, you must cease all use of the Software.
      </p>

      <h2>8. Export Compliance</h2>
      <p>
        You agree to comply with all applicable export and re-export control laws. You represent that you
        are not located in a country subject to U.S. government embargo and are not listed on any restricted
        parties list.
      </p>

      <h2>9. Governing Law</h2>
      <p>
        This EULA is governed by the laws of the State of California, USA. Disputes arising under this
        EULA shall be subject to the exclusive jurisdiction of the courts of San Diego County, California.
      </p>

      <h2>10. Entire Agreement</h2>
      <p>
        This EULA, together with the Terms of Service and Privacy Policy, constitutes the entire agreement
        between you and CTF Designs regarding the Software and supersedes all prior agreements.
      </p>

      <h2>11. Contact</h2>
      <p>
        CTF Designs · <a href="mailto:roman@ctfdesigns.com">roman@ctfdesigns.com</a>
      </p>
    </LegalPage>
  );
}
