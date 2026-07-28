import type { Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ComponentStrategyTableLegacy from './ComponentStrategyTableLegacy';
import ComponentAllocationTimingWorkspace from './ComponentAllocationTimingWorkspace';

type Props = {
  units: SellOffUnit[];
  components: Component[];
  onCreate: (patch?: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (mode?: 'default' | 'hybrid') => Promise<void>;
};

const SPLIT_PATCH_KEYS = [
  'allocation_percentage',
  'allocation_timing_schema_version',
] as const;

export function isSplitOnlyPatch(patch: Record<string, unknown>): boolean {
  const keys = Object.keys(patch).sort();
  return keys.length === SPLIT_PATCH_KEYS.length
    && SPLIT_PATCH_KEYS.every((key) => keys.includes(key));
}

export default function ComponentStrategyTable(props: Props) {
  async function guardedTimingUpdate(id: string, patch: Record<string, unknown>) {
    if (isSplitOnlyPatch(patch)) {
      throw new Error(
        'Allocatie splitsen wordt geactiveerd zodra de allocatiegewogen waardering in Fase 4C is aangesloten. Er is niets gewijzigd.',
      );
    }
    await props.onUpdate(id, patch);
  }

  return (
    <div className="space-y-3">
      <ComponentStrategyTableLegacy {...props} />
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
        Timing kan worden vastgelegd. Een allocatie daadwerkelijk splitsen blijft tijdelijk beveiligd,
        zodat de huidige niet-gewogen rekenkern een scenariowaarde niet dubbel kan tellen.
      </div>
      <ComponentAllocationTimingWorkspace
        units={props.units}
        onCreate={props.onCreate}
        onUpdate={guardedTimingUpdate}
      />
    </div>
  );
}
