import {
  PRIORITEIT_LABEL,
  STATUS_LABEL,
  AI_STATUS_LABEL,
  type OffMarketPrioriteit,
  type OffMarketStatus,
  type OffMarketAiStatus,
} from '@/lib/offMarket/types';

type Tone = 'neutral' | 'sand' | 'gold' | 'amber' | 'emerald' | 'crimson';

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-muted/60 text-muted-foreground border-border', dot: 'bg-muted-foreground/50' },
  sand:    { wrap: 'bg-secondary/15 text-foreground border-secondary/30', dot: 'bg-secondary' },
  gold:    { wrap: 'bg-accent/10 text-accent border-accent/25', dot: 'bg-accent' },
  amber:   { wrap: 'bg-warning/10 text-warning border-warning/25', dot: 'bg-warning' },
  emerald: { wrap: 'bg-success/10 text-success border-success/25', dot: 'bg-success' },
  crimson: { wrap: 'bg-destructive/10 text-destructive border-destructive/25', dot: 'bg-destructive' },
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

const prioriteitTone: Record<OffMarketPrioriteit, Tone> = {
  laag: 'neutral',
  midden: 'sand',
  hoog: 'amber',
  urgent: 'crimson',
};

const statusTone: Record<OffMarketStatus, Tone> = {
  nieuw_signaal: 'gold',
  te_onderzoeken: 'sand',
  eigenaar_achterhalen: 'sand',
  benaderen: 'amber',
  in_gesprek: 'amber',
  object_ontvangen: 'emerald',
  dealtraject: 'emerald',
  niet_interessant: 'neutral',
  archief: 'neutral',
};

export function OffMarketPriorityBadge({ prioriteit }: { prioriteit: OffMarketPrioriteit }) {
  return <Chip label={PRIORITEIT_LABEL[prioriteit]} tone={prioriteitTone[prioriteit]} />;
}

export function OffMarketStatusBadge({ status }: { status: OffMarketStatus }) {
  return <Chip label={STATUS_LABEL[status]} tone={statusTone[status]} />;
}

const aiStatusTone: Record<OffMarketAiStatus, Tone> = {
  niet_verrijkt: 'neutral',
  in_wachtrij: 'neutral',
  bezig: 'gold',
  klaar: 'emerald',
  mislukt: 'crimson',
};

export function OffMarketAiStatusBadge({ status }: { status: OffMarketAiStatus | string | null | undefined }) {
  const s = (status ?? 'niet_verrijkt') as OffMarketAiStatus;
  const label = AI_STATUS_LABEL[s] ?? String(status);
  const tone = aiStatusTone[s] ?? 'neutral';
  return <Chip label={label} tone={tone} />;
}
