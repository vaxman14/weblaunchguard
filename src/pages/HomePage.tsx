import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ThemeToggle } from "../components/ThemeToggle";
import { PricingCards } from "../features/billing/PricingCards";

const trustCues = [
  "Per-domain SOC 2-aligned launch checks on Basic, Pro, and Enterprise",
  "Domain ownership verified via DNS before any scan runs",
  "Plain-language evidence for founders, marketers, and developers"
];

type HomePageProps = {
  onAuthOpen?: () => void;
};

export function HomePage({ onAuthOpen }: HomePageProps) {
  return (
    <>
      <header className="border-b border-line/80 bg-page/90">
        <nav
          aria-label="Primary"
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <a className="text-lg font-semibold text-ink" href="#top">
            Web Launch Guard
          </a>
          <div className="flex flex-wrap items-center gap-3">
            <a className="text-sm font-semibold text-muted hover:text-ink" href="#pricing">
              Pricing
            </a>
            <a className="text-sm font-semibold text-muted hover:text-ink" href="#accessibility">
              Accessibility
            </a>
            <ThemeToggle />
            <Button
              className="min-h-10 px-3"
              onClick={onAuthOpen}
              variant="ghost"
            >
              Log in
            </Button>
            <Button
              className="min-h-10 px-3"
              onClick={onAuthOpen}
            >
              Sign up
            </Button>
          </div>
        </nav>
      </header>

      <main className="bg-page text-ink" id="top">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Operated by CTFDigital
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-ink sm:text-6xl">
              Web Launch Guard
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted">
              A focused launch-readiness workspace for SaaS teams that need clear public-site,
              accessibility, and trust signals before a launch goes live.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={onAuthOpen}
              >
                Sign up
              </Button>
              <Button
                onClick={onAuthOpen}
                variant="secondary"
              >
                Log in
              </Button>
            </div>
          </div>

          <div aria-labelledby="pricing-heading" id="pricing">
            <div className="mb-5 max-w-2xl">
              <h2 className="text-3xl font-semibold text-ink" id="pricing-heading">
                Pricing
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Pick the plan that matches your launch volume. Each domain is verified by DNS before any scan runs.
              </p>
            </div>
            <PricingCards />
          </div>
        </section>

        <section
          aria-labelledby="accessibility-heading"
          className="border-y border-line/80 bg-panel/55"
          id="accessibility"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 sm:px-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="text-3xl font-semibold text-ink" id="accessibility-heading">
                ADA-conscious by default
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              <Card className="p-5">
                <h3 className="text-lg font-semibold text-ink">Readable checks</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Findings are written for decision makers without hiding the practical web quality
                  signals teams need to address.
                </p>
              </Card>
              <Card className="p-5">
                <h3 className="text-lg font-semibold text-ink">Public-first posture</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  The homepage sets expectations for accessibility, privacy, and trust before auth,
                  billing, scanner, and dashboard work is introduced.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-8" aria-labelledby="trust-heading">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold text-ink" id="trust-heading">
              Launch trust cues
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Web Launch Guard keeps the first release practical: visible pricing, passive insight
              limits, and public-facing accessibility posture before deeper scanner and dashboard
              workflows arrive.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {trustCues.map((cue) => (
                <li className="flex gap-3 text-sm leading-6 text-ink" key={cue}>
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line/80 bg-panel/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Web Launch Guard is operated by <span>CTFDigital</span>.
          </p>
          <a className="font-semibold text-ink hover:text-accent" href="https://ctfdigital.store">
            ctfdigital.store
          </a>
        </div>
      </footer>
    </>
  );
}
