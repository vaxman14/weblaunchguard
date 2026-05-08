import { BrainCircuit, Radar } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import type { ProAnalysisMode } from "../../lib/api";

type ProModeSelectorProps = {
  disabled?: boolean;
  lockedReason?: string;
  onRun: (request: { context: string; mode: ProAnalysisMode }) => void;
};

const modes: Array<{
  bestFor: string;
  description: string;
  icon: typeof BrainCircuit;
  mode: ProAnalysisMode;
  title: string;
}> = [
  {
    bestFor: "Best for production apps or teams that want low traffic impact.",
    description:
      "Uses passive scan evidence plus your launch context to produce a deeper AI-prioritized security review.",
    icon: BrainCircuit,
    mode: "guided-ai-review",
    title: "Guided AI Review"
  },
  {
    bestFor: "Best when you own the app and want stronger evidence before launch.",
    description:
      "Makes safe same-domain page checks for headers, forms, cookies, and links before AI prioritization.",
    icon: Radar,
    mode: "controlled-live-inspection",
    title: "Controlled Live Inspection"
  }
];

export function ProModeSelector({ disabled = false, lockedReason, onRun }: ProModeSelectorProps) {
  const [mode, setMode] = useState<ProAnalysisMode>("guided-ai-review");
  const [context, setContext] = useState("");
  const isLocked = Boolean(lockedReason);

  return (
    <Card className="p-6" aria-labelledby="pro-analysis-heading">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Pro analysis</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink" id="pro-analysis-heading">
          Choose review depth
        </h2>
      </div>

      {lockedReason ? (
        <p className="mb-5 rounded-lg border border-line bg-page px-3 py-3 text-sm leading-6 text-muted" role="status">
          {lockedReason}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2" role="radiogroup" aria-label="Pro analysis mode">
        {modes.map((option) => {
          const Icon = option.icon;
          const selected = mode === option.mode;

          return (
            <button
              aria-checked={selected}
              className={`rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected ? "border-accent bg-page" : "border-line bg-panel hover:border-accent"
              }`}
              disabled={disabled || isLocked}
              key={option.mode}
              onClick={() => setMode(option.mode)}
              role="radio"
              type="button"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-lg border border-line bg-page p-2 text-accent">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="text-base font-semibold text-ink">{option.title}</span>
              </span>
              <span className="mt-3 block text-sm leading-6 text-muted">{option.description}</span>
              <span className="mt-3 block text-sm font-semibold leading-6 text-ink">{option.bestFor}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold text-ink" htmlFor="pro-context">
          Launch context
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-lg border border-line bg-page px-3 py-3 text-sm text-ink shadow-sm focus:border-accent"
          disabled={disabled || isLocked}
          id="pro-context"
          maxLength={2000}
          onChange={(event) => setContext(event.target.value)}
          placeholder="SaaS type, login model, payment flow, launch concerns, or areas you want prioritized."
          value={context}
        />
      </div>

      <Button
        className="mt-5"
        disabled={disabled || isLocked}
        onClick={() => onRun({ context: context.trim(), mode })}
      >
        {disabled ? "Running Pro analysis" : "Run Pro analysis"}
      </Button>
    </Card>
  );
}
