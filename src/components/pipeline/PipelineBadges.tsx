import { PIPELINE_FASES, INTERESSE_LABELS, type PipelineFase, type InteresseNiveau } from '@/data/mock-data';

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

const faseTone: Record<PipelineFase, Tone> = {
  match_gevonden: 'neutral',
  teaser_verstuurd: 'sand',
  interesse_ontvangen: 'sky',
  nda_verstuurd: 'sky',
  nda_getekend: 'sky',
  informatie_gedeeld: 'gold',
  bezichtiging_gepland: 'gold',
  bezichtiging_geweest: 'gold',
  indicatieve_bieding: 'amber',
  onderhandeling: 'amber',
  loi_ontvangen: 'amber',
  due_diligence: 'amber',
  koopovereenkomst_concept: 'emerald',
  koopovereenkomst_getekend: 'emerald',
  transport_closing: 'emerald',
  afgerond: 'neutral',
  afgevallen: 'crimson',
};

export const FASE_LABEL: Record<PipelineFase, string> =
  PIPELINE_FASES.reduce((acc, f) => ({ ...acc, [f.key]: f.label }), {} as Record<PipelineFase, string>);

export function PipelineFaseBadge({ fase }: { fase: PipelineFase }) {
  const t = toneStyles[faseTone[fase]];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${t.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {FASE_LABEL[fase]}
    </span>
  );
}

const interesseTone: Record<InteresseNiveau, Tone> = {
  koud: 'neutral',
  lauw: 'sand',
  warm: 'amber',
  zeer_warm: 'crimson',
};

export function InteresseNiveauBadge({ niveau }: { niveau: InteresseNiveau }) {
  const t = toneStyles[interesseTone[niveau]];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border rounded-full whitespace-nowrap ${t.wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {INTERESSE_LABELS[niveau]}
    </span>
  );
}
