import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { aggregateStrategy, STRATEGY_LABELS } from '@/lib/vastgoedrekenen/componentStrategy';
import { resolveComponentAllocationWeighting } from '@/lib/vastgoedrekenen/componentAllocationWeighting';
import { fmtEur } from './format';

type Props = {
  units: SellOffUnit[];
};

function raw(unit: SellOffUnit): Record<string, unknown> {
  return unit as unknown as Record<string, unknown>;
}

function allocationWasEntered(unit: SellOffUnit): boolean {
  const value = raw(unit).allocation_percentage;
  return value !== null && value !== undefined && value !== '';
}

function groupStatusLabel(status: 'complete' | 'underallocated' | 'overallocated') {
  if (status === 'complete') return 'Gewogen';
  if (status === 'underallocated') return 'Ongewogen · onderverdeeld';
  return 'Ongewogen · oververdeeld';
}

export default function ComponentAllocationValuationSummary({ units }: Props) {
  const totals = useMemo(() => aggregateStrategy(units), [units]);
  const allocation = useMemo(() => resolveComponentAllocationWeighting(units), [units]);
  const hasAllocationInput = units.some(allocationWasEntered);

  if (!hasAllocationInput || units.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border bg-card p-3" aria-label="Allocatiegewogen waardering">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold">Allocatiegewogen waardering</h4>
          <p className="text-xs text-muted-foreground">
            De strategie-invoer per regel blijft volledig zichtbaar. Hieronder staat welk deel daarvan
            effectief meetelt in de scenariowaarde. Timing wordt nog niet verdisconteerd.
          </p>
        </div>
        <div className="text-xs sm:text-right">
          <p className="text-muted-foreground">Effectieve scenariowaarde</p>
          <p className="font-mono-data font-semibold">{fmtEur(totals.scenarioValue)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {units.map((unit) => {
          const timing = allocation.byUnitId.get(unit.id);
          const result = totals.perUnit.find((item) => item.unitId === unit.id);
          const record = raw(unit);
          const label = (record.unit_label as string | null)
            ?? (unit as unknown as { unit_name?: string }).unit_name
            ?? 'Unit';
          const strategy = record.strategy as keyof typeof STRATEGY_LABELS | null;
          const status = timing?.groupStatus ?? 'complete';

          return (
            <div
              key={unit.id}
              className="flex flex-col gap-1 rounded-md border px-2.5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{label}</p>
                <p className="text-muted-foreground break-words">
                  {strategy ? STRATEGY_LABELS[strategy] : 'Strategie ontbreekt'}
                  {' · '}
                  {timing?.allocationPercentage ?? 100}% allocatie
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant={status === 'complete' ? 'default' : 'outline'}>
                  {groupStatusLabel(status)}
                </Badge>
                <span className="font-mono-data font-semibold whitespace-nowrap">
                  {result && result.contribution > 0 ? fmtEur(result.contribution) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
