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

export default function ComponentStrategyTable(props: Props) {
  return (
    <div className="space-y-3">
      <ComponentStrategyTableLegacy {...props} />
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200">
        Complete allocatiegroepen van exact 100% worden financieel gewogen. Onder- of oververdeelde
        groepen blijven tijdelijk ongewogen en tonen een waarschuwing, zodat onvolledige invoer de
        scenariowaarde niet stilzwijgend verandert. Timing beïnvloedt de waarde nog niet.
      </div>
      <ComponentAllocationTimingWorkspace
        units={props.units}
        onCreate={props.onCreate}
        onUpdate={props.onUpdate}
      />
    </div>
  );
}
