import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { ASSUMPTION_PROFILE_LABELS, COST_STRUCTURE_LABELS, RENT_SOURCE_LABELS } from '@/lib/vastgoedrekenen/profiles';

const OVB_MODE_LABELS: Record<string, string> = {
  auto: 'automatisch',
  per_component: 'per component',
  manual: 'handmatig',
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
  const [open, setOpen] = useState(false);
  const rentSource = RENT_SOURCE_LABELS[scenario.rent_source ?? 'handmatig'] ?? '—';
  const profile = ASSUMPTION_PROFILE_LABELS[(scenario.assumption_profile ?? 'conservatief') as keyof typeof ASSUMPTION_PROFILE_LABELS] ?? '—';
  const ovb = OVB_MODE_LABELS[scenario.ovb_mode] ?? '—';
  const summary = `${rentSource} · ${profile} · OVB ${ovb} · betrouwbaarheid ${outputs.inputReliability}`;

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors min-w-0"
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Rekenbasis</span>
        <span className="text-xs text-foreground truncate flex-1">{summary}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 min-w-0">
            <Item label="Huurbron" value={rentSource} />
            <Item label="Aannameprofiel" value={profile} />
            <Item label="Huurtype" value={RENT_CHOICE_LABELS[scenario.rent_choice ?? 'huidig'] ?? '—'} />
            <Item label="OVB-modus" value={ovb} />
            <Item label="Kostenstructuur" value={COST_STRUCTURE_LABELS[scenario.cost_structure ?? 'onbekend'] ?? '—'} />
            <Item label="Gewenste BAR" value={`${Number(scenario.target_bar ?? 0).toFixed(1)}%`} />
            <Item label="Inputbetrouwbaarheid" value={outputs.inputReliability} />
          </div>
        </div>
      )}
    </div>
  );
}
