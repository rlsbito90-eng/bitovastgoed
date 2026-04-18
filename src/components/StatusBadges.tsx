import type { LeadStatus, DealFase, ObjectStatus, TaakPrioriteit, TaakStatus } from '@/data/mock-data';

/**
 * Boutique status chip — flat, calm, with a thin colored dot for instant scanability.
 * Avoids the loud "pill" SaaS look and stays consistent across modules.
 */
type Tone = 'neutral' | 'sand' | 'gold' | 'amber' | 'emerald' | 'crimson';

const toneStyles: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-muted/60 text-muted-foreground border-border', dot: 'bg-muted-foreground/50' },
  sand:    { wrap: 'bg-secondary/15 text-foreground border-secondary/30', dot: 'bg-secondary' },
  gold:    { wrap: 'bg-accent/10 text-accent border-accent/25', dot: 'bg-accent' },
  amber:   { wrap: 'bg-warning/10 text-warning border-warning/25', dot: 'bg-warning' },
  emerald: { wrap: 'bg-success/10 text-success border-success/25', dot: 'bg-success' },
  crimson: { wrap: 'bg-destructive/10 text-destructive border-destructive/25', dot: 'bg-destructive' },
};

function Chip({ label, tone, className = '' }: { label: string; tone: Tone; className?: string }) {
  const t = toneStyles[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${t.wrap} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

const leadStatusConfig: Record<LeadStatus, { label: string; tone: Tone }> = {
  koud:   { label: 'Koud',   tone: 'neutral' },
  lauw:   { label: 'Lauw',   tone: 'sand' },
  warm:   { label: 'Warm',   tone: 'amber' },
  actief: { label: 'Actief', tone: 'emerald' },
};

const dealFaseConfig: Record<DealFase, { label: string; tone: Tone }> = {
  lead:           { label: 'Lead',           tone: 'neutral' },
  introductie:    { label: 'Introductie',    tone: 'sand' },
  interesse:      { label: 'Interesse',      tone: 'gold' },
  bezichtiging:   { label: 'Bezichtiging',   tone: 'gold' },
  bieding:        { label: 'Bieding',        tone: 'amber' },
  onderhandeling: { label: 'Onderhandeling', tone: 'amber' },
  closing:        { label: 'Closing',        tone: 'emerald' },
  afgerond:       { label: 'Afgerond',       tone: 'emerald' },
  afgevallen:     { label: 'Afgevallen',     tone: 'crimson' },
};

const objectStatusConfig: Record<ObjectStatus, { label: string; tone: Tone }> = {
  'off-market':    { label: 'Off-market',    tone: 'gold' },
  'in_onderzoek':  { label: 'In onderzoek',  tone: 'sand' },
  'beschikbaar':   { label: 'Beschikbaar',   tone: 'emerald' },
  'onder_optie':   { label: 'Onder optie',   tone: 'amber' },
  'verkocht':      { label: 'Verkocht',      tone: 'neutral' },
  'ingetrokken':   { label: 'Ingetrokken',   tone: 'crimson' },
};

const prioriteitConfig: Record<TaakPrioriteit, { label: string; tone: Tone }> = {
  laag:    { label: 'Laag',    tone: 'neutral' },
  normaal: { label: 'Normaal', tone: 'sand' },
  hoog:    { label: 'Hoog',    tone: 'amber' },
  urgent:  { label: 'Urgent',  tone: 'crimson' },
};

const taakStatusConfig: Record<TaakStatus, { label: string; tone: Tone }> = {
  open:          { label: 'Open',          tone: 'gold' },
  in_uitvoering: { label: 'In uitvoering', tone: 'amber' },
  afgerond:      { label: 'Afgerond',      tone: 'emerald' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const c = leadStatusConfig[status];
  return <Chip label={c.label} tone={c.tone} />;
}

export function DealFaseBadge({ fase }: { fase: DealFase }) {
  const c = dealFaseConfig[fase];
  return <Chip label={c.label} tone={c.tone} />;
}

export function ObjectStatusBadge({ status }: { status: ObjectStatus }) {
  const c = objectStatusConfig[status];
  return <Chip label={c.label} tone={c.tone} />;
}

export function PrioriteitBadge({ prioriteit }: { prioriteit: TaakPrioriteit }) {
  const c = prioriteitConfig[prioriteit];
  return <Chip label={c.label} tone={c.tone} />;
}

export function TaakStatusBadge({ status }: { status: TaakStatus }) {
  const c = taakStatusConfig[status];
  return <Chip label={c.label} tone={c.tone} />;
}

export function MatchScoreBadge({ score }: { score: number }) {
  const tone: Tone = score >= 75 ? 'emerald' : score >= 50 ? 'amber' : 'neutral';
  return <Chip label={`${score}%`} tone={tone} className="font-mono-data" />;
}
