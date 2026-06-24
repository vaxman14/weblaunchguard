import { ArrowRight } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

const CTF_URL = "https://ctfdesigns.com";
const CTF_CONTACT = "https://ctfdesigns.com/contact.html";

type CtfCalloutProps = {
  /** When true, lead with "we'll fix what we found". */
  hasFindings?: boolean;
};

// Lead-funnel CTA. Web Launch Guard is a free marketing tool whose whole job is
// to surface site problems and route the visitor to CTF Designs to fix them.
export function CtfCallout({ hasFindings = true }: CtfCalloutProps) {
  return (
    <Card className="border-accent/40 bg-accent/5 p-6">
      <h3 className="text-lg font-semibold text-ink">
        {hasFindings ? "Want these issues fixed for you?" : "Want a faster, safer, more compliant site?"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Web Launch Guard is a free tool built by CTF Designs. We design and rebuild fast, secure,
        ADA-compliant websites — and we can fix everything this scan flagged. No obligation, just a look.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => window.open(CTF_CONTACT, "_blank", "noopener,noreferrer")}>
          Get this fixed
          <ArrowRight aria-hidden="true" size={16} />
        </Button>
        <Button onClick={() => window.open(CTF_URL, "_blank", "noopener,noreferrer")} variant="secondary">
          See our work
        </Button>
      </div>
      <p className="mt-4 border-t border-line/60 pt-3 text-xs leading-5 text-muted">
        Web Launch Guard is a free, automated marketing tool — not a professional security audit. Its reports
        are informational and meant to be reviewed and interpreted by CTF Designs as a starting point for
        improving your site. CTF Designs, its owner, and any affiliated companies accept no responsibility or
        liability for any use of, interpretation of, or reliance on a report by any other party.
      </p>
    </Card>
  );
}
