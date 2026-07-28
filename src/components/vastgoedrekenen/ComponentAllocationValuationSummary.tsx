import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { aggregateStrategy, STRATEGY_LABELS } from '@/lib/vastgoedrekenen/componentStrategy';
import { resolveComponentAllocationWeighting } from '@/lib/vastgoedrekenen/componentAllocationWeighting';
import { fmtEur, fmtEurPerM2, fmtM2 } from './format';

type Props = {
  units: SellOffUnit[];
};

function raw(unit: SellOffUnit): Record<string, unknown> {
  return unit as unknown as Record<string, unknown>;
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceSurface(unit: SellOffUnit): number {
  const record = raw(unit);
  return finiteNumber(record.surface_gbo)
    || finiteNumber(record.surface_vvo)
    || finiteNumber(record.surface_bvo);
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

  const effectiveSurface = useMemo(
    () => units.reduce((sum, unit) => {
      const weight = allocation.byUnitId.get(unit.id)?.effectiveWeight ?? 1;
      return sum + sourceSurface(unit) * weight;
    }, 0),
    [allocation, units],
  );
  const effectivePricePerM2 = totals.scenarioValue > 0 && effectiveSurface > 0
    ? Math.round(totals.scenarioValue / effectiveSurface)
    : 0;

  if (!hasAllocationInput || units.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border bg-card p-3" aria-label="Allocatiegewogen waardering">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold">Allocatiegewogen waardering</h4>
          <p className="text-xs text-muted-foreground">
            De strategie-invoer en bronoppervlakte per regel blijven volledig zichtbaar. Hieronder staan
            de effectieve bijdrage en het effectief toegewezen oppervlak. Timing wordt nog niet verdisconteerd.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 sm:text-right">
          <div>
            <p className="text-muted-foreground">Effectieve scenariowaarde</p>
            <p className="font-mono-data font-semibold">{fmtEur(totals.scenarioValue)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Effectief oppervlak</p>
            <p className="font-mono-data font-semibold">
              {effectiveSurface > 0 ? fmtM2(effectiveSurface) : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Effectieve waarde/m²</p>
            <p className="font-mono-data font-semibold">
              {effectivePricePerM2 > 0 ? fmtEurPerM2(effectivePricePerM2) : '—'}
            </p>
          </div>
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
          const effectiveUnitSurface = sourceSurface(unit) * (timing?.effectiveWeight ?? 1);
          const unitPricePerM2 = result && result.contribution > 0 && effectiveUnitSurface > 0
            ? Math.round(result.contribution / effectiveUnitSurface)
            : 0;

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
                  {effectiveUnitSurface > 0 ? ` · effectief ${fmtM2(effectiveUnitSurface)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant={status === 'complete' ? 'default' : 'outline'}>
                  {groupStatusLabel(status)}
                </Badge>
                <span className="font-mono-data font-semibold whitespace-nowrap">
                  {result && result.contribution > 0 ? fmtEur(result.contribution) : '—'}
                </span>
                <span className="font-mono-data text-muted-foreground whitespace-nowrap">
                  {unitPricePerM2 > 0 ? fmtEurPerM2(unitPricePerM2) : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
