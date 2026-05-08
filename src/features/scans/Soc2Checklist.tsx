import { Check, X } from "lucide-react";
import { Card } from "../../components/Card";
import type { Soc2Checklist as Soc2ChecklistType } from "../../lib/api";

type Soc2ChecklistProps = {
  checklist: Soc2ChecklistType | null;
};

export function Soc2Checklist({ checklist }: Soc2ChecklistProps) {
  if (!checklist) {
    return (
      <Card aria-labelledby="soc2-heading" className="p-6">
        <div className="mb-3">
          <h2 className="text-2xl font-semibold text-ink" id="soc2-heading">
            SOC 2 launch checklist
          </h2>
          <p className="mt-2 text-sm text-muted">
            Run a scan on a verified domain to generate a SOC 2 Trust Services checklist tailored to your evidence.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="soc2-heading" className="p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink" id="soc2-heading">
            SOC 2 launch checklist
          </h2>
          <p className="mt-2 text-sm text-muted">
            {checklist.passed} of {checklist.total} controls passing on the latest evidence.
          </p>
        </div>
      </div>
      <ul className="space-y-3" aria-label="SOC 2 controls">
        {checklist.items.map((item) => (
          <li className="rounded-lg border border-line bg-page p-4" key={item.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{item.criterion}</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  item.passing
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {item.passing ? <Check aria-hidden="true" size={14} /> : <X aria-hidden="true" size={14} />}
                {item.passing ? "Passing" : "Action needed"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{item.rationale}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
