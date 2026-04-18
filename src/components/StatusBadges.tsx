import { Badge } from '@/components/ui/badge';
import type { LeadStatus, DealFase, ObjectStatus, TaakPrioriteit, TaakStatus } from '@/data/mock-data';

const leadStatusConfig: Record<LeadStatus, { label: string; className: string }> = {
  koud: { label: 'Koud', className: 'bg-muted text-muted-foreground' },
  lauw: { label: 'Lauw', className: 'bg-secondary text-secondary-foreground' },
  warm: { label: 'Warm', className: 'bg-warning/15 text-warning border-warning/20' },
  actief: { label: 'Actief', className: 'bg-success/15 text-success border-success/20' },
};

const dealFaseConfig: Record<DealFase, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-muted text-muted-foreground' },
  introductie: { label: 'Introductie', className: 'bg-secondary text-secondary-foreground' },
  interesse: { label: 'Interesse', className: 'bg-accent/15 text-accent' },
  bezichtiging: { label: 'Bezichtiging', className: 'bg-accent/15 text-accent' },
  bieding: { label: 'Bieding', className: 'bg-warning/15 text-warning' },
  onderhandeling: { label: 'Onderhandeling', className: 'bg-warning/15 text-warning' },
  closing: { label: 'Closing', className: 'bg-success/15 text-success' },
  afgerond: { label: 'Afgerond', className: 'bg-success/15 text-success' },
  afgevallen: { label: 'Afgevallen', className: 'bg-destructive/15 text-destructive' },
};

const objectStatusConfig: Record<ObjectStatus, { label: string; className: string }> = {
  'off-market': { label: 'Off-market', className: 'bg-success/15 text-success' },
  'in_onderzoek': { label: 'In onderzoek', className: 'bg-accent/15 text-accent' },
  'beschikbaar': { label: 'Beschikbaar', className: 'bg-success/15 text-success' },
  'onder_optie': { label: 'Onder optie', className: 'bg-warning/15 text-warning' },
  'verkocht': { label: 'Verkocht', className: 'bg-muted text-muted-foreground' },
  'ingetrokken': { label: 'Ingetrokken', className: 'bg-destructive/15 text-destructive' },
};

const prioriteitConfig: Record<TaakPrioriteit, { label: string; className: string }> = {
  laag: { label: 'Laag', className: 'bg-muted text-muted-foreground' },
  normaal: { label: 'Normaal', className: 'bg-secondary text-secondary-foreground' },
  hoog: { label: 'Hoog', className: 'bg-warning/15 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/15 text-destructive' },
};

const taakStatusConfig: Record<TaakStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-accent/15 text-accent' },
  in_uitvoering: { label: 'In uitvoering', className: 'bg-warning/15 text-warning' },
  afgerond: { label: 'Afgerond', className: 'bg-success/15 text-success' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = leadStatusConfig[status];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function DealFaseBadge({ fase }: { fase: DealFase }) {
  const config = dealFaseConfig[fase];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function ObjectStatusBadge({ status }: { status: ObjectStatus }) {
  const config = objectStatusConfig[status];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function PrioriteitBadge({ prioriteit }: { prioriteit: TaakPrioriteit }) {
  const config = prioriteitConfig[prioriteit];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function TaakStatusBadge({ status }: { status: TaakStatus }) {
  const config = taakStatusConfig[status];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

export function MatchScoreBadge({ score }: { score: number }) {
  const className = score >= 75
    ? 'bg-success/15 text-success border-success/20'
    : score >= 50
      ? 'bg-warning/15 text-warning border-warning/20'
      : 'bg-muted text-muted-foreground';
  return <Badge variant="outline" className={className}>{score}%</Badge>;
}
