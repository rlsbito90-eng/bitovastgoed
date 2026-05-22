import { effectieveStatus } from '@/lib/biedingen/format';
import { BIEDING_STATUS_LABELS, BIEDING_TYPE_LABELS, BIEDING_RICHTING_LABELS } from '@/lib/biedingen/types';
import type { Bieding, BiedingStatus, BiedingType, BiedingRichting } from '@/lib/biedingen/types';

type Tone = 'neutral' | 'sand' | 'gold' | 'amber' | 'emerald' | 'crimson' | 'sky';

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-muted/60 text-muted-foreground border-border', dot: 'bg-muted-foreground/50' },
  sand:    { wrap: 'bg-secondary/15 text-foreground border-secondary/30', dot: 'bg-secondary' },
  gold:    { wrap: 'bg-accent/10 text-accent border-accent/25', dot: 'bg-accent' },
  amber:   { wrap: 'bg-warning/10 text-warning border-warning/25', dot: 'bg-warning' },
  emerald: { wrap: 'bg-success/10 text-success border-success/25', dot: 'bg-success' },
  crimson: { wrap: 'bg-destructive/10 text-destructive border-destructive/25', dot: 'bg-destructive' },
  sky:     { wrap: 'bg-primary/10 text-primary border-primary/25', dot: 'bg-primary' },
};

function Chip({ label, tone }: { label: string; tone: Tone }) {
  const t = toneStyles[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${t.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

const statusTone: Record<BiedingStatus, Tone> = {
  concept: 'neutral',
  ontvangen: 'sky',
  in_behandeling: 'gold',
  tegenvoorstel_gedaan: 'amber',
  aangepast_bod_gevraagd: 'amber',
  geaccepteerd: 'emerald',
  afgewezen: 'crimson',
  ingetrokken: 'neutral',
  verlopen: 'neutral',
};

export function OfferStatusBadge({ bieding }: { bieding: Bieding }) {
  const s = effectieveStatus(bieding);
  return <Chip label={BIEDING_STATUS_LABELS[s]} tone={statusTone[s]} />;
}

const typeTone: Record<BiedingType, Tone> = {
  indicatief: 'sand',
  openingsbod: 'sand',
  voorwaardelijk: 'gold',
  onvoorwaardelijk: 'emerald',
  eindbod: 'amber',
  tegenvoorstel: 'amber',
  verhoogd_bod: 'sky',
  schriftelijk: 'sand',
  mondeling: 'sand',
};

export function OfferTypeBadge({ type }: { type: BiedingType }) {
  return <Chip label={BIEDING_TYPE_LABELS[type]} tone={typeTone[type]} />;
}

const richtingTone: Record<BiedingRichting, Tone> = {
  van_koper: 'sky',
  van_verkoper: 'gold',
  namens_verkoper: 'gold',
  intern: 'neutral',
};

export function OfferDirectionBadge({ richting }: { richting: BiedingRichting }) {
  return <Chip label={BIEDING_RICHTING_LABELS[richting]} tone={richtingTone[richting]} />;
}
