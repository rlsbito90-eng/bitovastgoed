import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { ASSUMPTION_PROFILE_LABELS, COST_STRUCTURE_LABELS, RENT_SOURCE_LABELS } from '@/lib/vastgoedrekenen/profiles';

const OVB_MODE_LABELS: Record<string, string> = {
  auto: 'Automatisch',
  per_component: 'Per component',
  manual: 'Handmatig',
};

const RENT_CHOICE_LABELS: Record<string, string> = {
  huidig: 'Huidige huur',
  markt: 'Markthuur',
  wws: 'WWS-gecorrigeerd',
  handmatig: 'Handmatig',
};

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] uppercase tracking-normal sm:tracking-wide leading-snug text-muted-foreground whitespace-normal break-words">{label}</span>
      <span className="text-xs font-medium leading-snug text-foreground whitespace-normal break-words">{value}</span>
    </div>
  );
}

export default function RekenbasisBar({ scenario, outputs }: { scenario: Scenario; outputs: ComputedOutputs }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Rekenbasis</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 min-w-0">
        <Item label="Huurbron" value={RENT_SOURCE_LABELS[scenario.rent_source ?? 'handmatig'] ?? '—'} />
        <Item label="Aannameprofiel" value={ASSUMPTION_PROFILE_LABELS[(scenario.assumption_profile ?? 'conservatief') as keyof typeof ASSUMPTION_PROFILE_LABELS] ?? '—'} />
        <Item label="Huurtype" value={RENT_CHOICE_LABELS[scenario.rent_choice ?? 'huidig'] ?? '—'} />
        <Item label="OVB-modus" value={OVB_MODE_LABELS[scenario.ovb_mode] ?? '—'} />
        <Item label="Kostenstructuur" value={COST_STRUCTURE_LABELS[scenario.cost_structure ?? 'onbekend'] ?? '—'} />
        <Item label="Gewenste BAR" value={`${Number(scenario.target_bar ?? 0).toFixed(1)}%`} />
        <Item label="Inputbetrouwbaarheid" value={outputs.inputReliability} />
      </div>
    </div>
  );
}
