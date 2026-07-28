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
      <ComponentAllocationTimingWorkspace
        units={props.units}
        onCreate={props.onCreate}
        onUpdate={props.onUpdate}
      />
    </div>
  );
}
