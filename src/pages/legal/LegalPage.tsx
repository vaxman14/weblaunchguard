import type { ReactNode } from "react";
import { Button } from "../../components/Button";

type LegalPageProps = {
  children: ReactNode;
  onBack: () => void;
  title: string;
  updated: string;
};

export function LegalPage({ children, onBack, title, updated }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line/80 bg-page/90">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4 sm:px-8">
          <span className="text-base font-semibold">Web Launch Guard</span>
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8">
        <h1 className="mb-2 text-3xl font-semibold">{title}</h1>
        <p className="mb-8 text-sm text-muted">Last updated: {updated}</p>
        <div className="prose-sm space-y-6 leading-7 text-muted [&_a]:text-accent [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="border-t border-line/80 bg-panel/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 text-sm text-muted sm:px-8">
          <p>© 2026 CTF Designs. All rights reserved.</p>
          <p>Web Launch Guard</p>
        </div>
      </footer>
    </div>
  );
}
