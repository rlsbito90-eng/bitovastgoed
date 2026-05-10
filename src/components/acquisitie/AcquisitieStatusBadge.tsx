import { ACQUISITIE_STATUS_LABEL, type AcquisitieStatus } from '@/lib/acquisitie';

type Tone = 'neutral' | 'sand' | 'gold' | 'amber' | 'emerald' | 'crimson';

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-muted/60 text-muted-foreground border-border', dot: 'bg-muted-foreground/50' },
  sand:    { wrap: 'bg-secondary/15 text-foreground border-secondary/30', dot: 'bg-secondary' },
  gold:    { wrap: 'bg-accent/10 text-accent border-accent/25', dot: 'bg-accent' },
  amber:   { wrap: 'bg-warning/10 text-warning border-warning/25', dot: 'bg-warning' },
  emerald: { wrap: 'bg-success/10 text-success border-success/25', dot: 'bg-success' },
  crimson: { wrap: 'bg-destructive/10 text-destructive border-destructive/25', dot: 'bg-destructive' },
};

const statusTone: Record<AcquisitieStatus, Tone> = {
  target_gevonden: 'neutral',
  eigenaar_achterhalen: 'sand',
  eerste_benadering: 'sand',
  follow_up_gepland: 'gold',
  reactie_ontvangen: 'amber',
  verkoopbereidheid_peilen: 'amber',
  potentiele_verkooppositie: 'emerald',
  object_aangemaakt: 'emerald',
  niet_interessant: 'crimson',
};

export default function AcquisitieStatusBadge({ status }: { status: AcquisitieStatus }) {
  const t = toneStyles[statusTone[status]];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${t.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {ACQUISITIE_STATUS_LABEL[status]}
    </span>
  );
}
