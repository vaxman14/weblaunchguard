import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

type OnboardingPageProps = {
  onFinish: () => void;
};

const steps = [
  {
    body: "Web Launch Guard checks security headers, cookie hygiene, accessibility signals, and transport security. Each scan runs passively — we only fetch your public homepage, no credentials or session cookies.",
    cta: "Next: Add a domain",
    heading: "What we check",
    id: "intro",
    label: "1"
  },
  {
    body: "Add a subscription, then register your domain hostname (e.g. acme.io). One domain per Basic subscription. Pro covers up to 3. You can add and remove domains at any time.",
    cta: "Next: Verify ownership",
    heading: "Add your domain",
    id: "domain",
    label: "2"
  },
  {
    body: "To prevent scanning sites you don't control, we require a DNS TXT record. Go to your DNS provider, add a TXT record for your hostname with the verification value shown on the dashboard, then click Verify.",
    cta: "Next: Run your scan",
    heading: "Verify DNS ownership",
    id: "verify",
    label: "3"
  },
  {
    body: "Once your domain is verified, enter its URL in the scanner and click Run Scan. Your first report is ready in seconds. Share it with your team or export it as PDF.",
    cta: "Go to dashboard",
    heading: "Run your first scan",
    id: "scan",
    label: "4"
  }
];

export function OnboardingPage({ onFinish }: OnboardingPageProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="border-b border-line/80 bg-page/90">
        <nav aria-label="Onboarding" className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <p className="text-lg font-semibold text-ink">Web Launch Guard</p>
          <button className="text-sm text-muted hover:text-ink" onClick={onFinish} type="button">
            Skip
          </button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 sm:px-8">
        <div className="mb-8 flex gap-2">
          {steps.map((s, i) => (
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-line"}`}
              key={s.id}
            />
          ))}
        </div>

        <Card className="p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Step {current.label} of {steps.length}
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-ink">{current.heading}</h1>
          <p className="mt-5 text-base leading-8 text-muted">{current.body}</p>
          <Button className="mt-8 w-full" onClick={next}>
            {current.cta}
          </Button>
        </Card>

        <div className="mt-6 flex justify-center gap-2">
          {steps.map((s, i) => (
            <button
              aria-label={`Go to step ${i + 1}`}
              className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-accent" : "bg-line hover:bg-muted"}`}
              key={s.id}
              onClick={() => setStep(i)}
              type="button"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
