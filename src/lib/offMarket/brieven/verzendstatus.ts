// Verzendstatus-helpers voor off_market_brieven.
// `verzendstatus` is het fijnmazige werklog ("waar staat de brief feitelijk
// in het verzendproces"), `status` blijft canoniek concept/verstuurd.

export type Verzendstatus =
  | 'concept'
  | 'pdf_gegenereerd'
  | 'geprint'
  | 'in_envelop'
  | 'gepost'
  | 'verzonden'
  | 'geannuleerd'
  | 'retour';

export type Kanaal =
  | 'post'
  | 'email'
  | 'telefoon'
  | 'whatsapp'
  | 'linkedin'
  | 'anders';

export const VERZENDSTATUS_LABEL: Record<Verzendstatus, string> = {
  concept: 'Concept',
  pdf_gegenereerd: 'PDF gegenereerd',
  geprint: 'Geprint',
  in_envelop: 'In envelop',
  gepost: 'Gepost',
  verzonden: 'Verzonden',
  geannuleerd: 'Geannuleerd',
  retour: 'Retour',
};

export const KANAAL_LABEL: Record<Kanaal, string> = {
  post: 'Post',
  email: 'E-mail',
  telefoon: 'Telefoon',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  anders: 'Anders',
};

const RANK: Record<Verzendstatus, number> = {
  concept: 0,
  pdf_gegenereerd: 1,
  geprint: 2,
  in_envelop: 3,
  gepost: 4,
  verzonden: 4,
  geannuleerd: 9,
  retour: 9,
};

/** True wanneer `nieuw` een vooruitgang is t.o.v. `huidig` (geen downgrade). */
export function isProgressie(huidig: Verzendstatus | null | undefined, nieuw: Verzendstatus): boolean {
  if (!huidig) return true;
  return RANK[nieuw] > RANK[huidig];
}

export function badgeClassVoorVerzendstatus(v: Verzendstatus): string {
  switch (v) {
    case 'gepost':
    case 'verzonden':
      return 'bg-success/10 text-success border-success/25';
    case 'geprint':
    case 'in_envelop':
    case 'pdf_gegenereerd':
      return 'bg-secondary/15 text-foreground border-secondary/30';
    case 'retour':
    case 'geannuleerd':
      return 'bg-destructive/10 text-destructive border-destructive/25';
    default:
      return 'bg-muted/40 text-muted-foreground border-border';
  }
}
