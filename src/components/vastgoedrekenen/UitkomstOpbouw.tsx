import { Calculator, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import {
  buildOutcomeExplanation,
  type OutcomeLine,
  type OutcomeOriginKind,
} from '@/lib/vastgoedrekenen/outcomeExplanation';
import { fmtEur } from './format';

const ORIGIN_LABELS: Record<OutcomeOriginKind, string> = {
  input: 'Invoer',
  derived: 'Afgeleid',
  assumption: 'Aanname',
  computed: 'Berekening',
};

const ORIGIN_CLASSES: Record<OutcomeOriginKind, string> = {
  input: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  derived: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  assumption: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  computed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
};

function signedAmount(line: OutcomeLine): string {
  if (line.role === 'deduction') return `− ${fmtEur(Math.abs(line.value))}`;
  if (line.role === 'basis') return `+ ${fmtEur(Math.abs(line.value))}`;
  return fmtEur(line.value);
}

function OutcomeRow({ line }: { line: OutcomeLine }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-dashed py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{line.label}</span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${ORIGIN_CLASSES[line.originKind]}`}>
            {ORIGIN_LABELS[line.originKind]}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{line.originLabel}</p>
        {line.explanation && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{line.explanation}</p>}
      </div>
      <span className={`font-mono-data text-xs font-medium tabular-nums sm:text-right ${line.role === 'deduction' ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'}`}>
        {signedAmount(line)}
      </span>
    </div>
  );
}

export default function UitkomstOpbouw({ scenario, outputs }: { scenario: Scenario; outputs: ComputedOutputs }) {
  const explanation = buildOutcomeExplanation(scenario, outputs);
  if (!explanation) return null;

  return (
    <details className="group rounded-md border border-primary/30 bg-primary/5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 marker:content-none">
        <div className="flex min-w-0 gap-2.5">
          <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{explanation.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{explanation.summary}</p>
            {explanation.bindingLabel && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Bindend uitgangspunt: <span className="font-medium text-foreground">{explanation.bindingLabel}</span>
              </p>
            )}
          </div>
        </div>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-primary/20 p-3">
        <div className="flex flex-wrap gap-1.5 text-[9px]">
          {(Object.keys(ORIGIN_LABELS) as OutcomeOriginKind[]).map((kind) => (
            <span key={kind} className={`rounded-full border px-1.5 py-0.5 font-medium uppercase tracking-wide ${ORIGIN_CLASSES[kind]}`}>
              {ORIGIN_LABELS[kind]}
            </span>
          ))}
        </div>

        {explanation.stages.map((stage) => {
          const closes = Math.abs(stage.roundingDifference) <= 1;
          return (
            <section key={stage.id} className="rounded-md border bg-background/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">{stage.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{stage.formula}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium ${
                  closes
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                }`}>
                  {closes ? <CheckCircle2 className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                  {closes ? 'Optelling sluit aan' : `Afrondingsverschil ${fmtEur(stage.roundingDifference)}`}
                </span>
              </div>

              <div className="mt-1">
                {stage.lines.map((line) => <OutcomeRow key={line.id} line={line} />)}
              </div>

              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">{stage.resultLabel}</p>
                  <p className="text-[10px] text-muted-foreground">Berekende uitkomst van deze stap</p>
                </div>
                <p className="font-mono-data text-base font-semibold tabular-nums text-primary">{fmtEur(stage.resultValue)}</p>
              </div>
            </section>
          );
        })}

        <p className="text-[10px] leading-snug text-muted-foreground">
          Deze opbouw verklaart de actuele rekenuitkomst met de bestaande scenario-invoer. De labels geven aan of een regel rechtstreeks is ingevoerd, afgeleid, als aanname geldt of door het model is berekend.
        </p>
      </div>
    </details>
  );
}
