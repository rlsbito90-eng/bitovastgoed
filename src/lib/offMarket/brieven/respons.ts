// Responsstatussen voor off-market brieven (per geadresseerde).
// UI-labels strikt Nederlands.

export type Responsstatus =
  | 'geen_reactie'
  | 'reactie_ontvangen'
  | 'interesse'
  | 'niet_geinteresseerd'
  | 'later_opnieuw_benaderen'
  | 'wil_meer_informatie'
  | 'gesprek_gepland'
  | 'verkeerd_adres'
  | 'retour_post'
  | 'verkocht_of_niet_relevant'
  | 'afgevallen';

export const RESPONS_LABEL: Record<Responsstatus, string> = {
  geen_reactie: 'Geen reactie',
  reactie_ontvangen: 'Reactie ontvangen',
  interesse: 'Interesse',
  niet_geinteresseerd: 'Niet geïnteresseerd',
  later_opnieuw_benaderen: 'Later opnieuw benaderen',
  wil_meer_informatie: 'Wil meer informatie',
  gesprek_gepland: 'Gesprek gepland',
  verkeerd_adres: 'Verkeerd adres',
  retour_post: 'Retour post',
  verkocht_of_niet_relevant: 'Verkocht / niet relevant',
  afgevallen: 'Afgevallen',
};

/** Volgorde voor dropdowns. */
export const RESPONS_VOLGORDE: Responsstatus[] = [
  'reactie_ontvangen',
  'interesse',
  'wil_meer_informatie',
  'gesprek_gepland',
  'later_opnieuw_benaderen',
  'niet_geinteresseerd',
  'verkeerd_adres',
  'retour_post',
  'verkocht_of_niet_relevant',
  'afgevallen',
  'geen_reactie',
];

export function isNegatieveRespons(r: Responsstatus | null | undefined): boolean {
  return r === 'niet_geinteresseerd'
      || r === 'retour_post'
      || r === 'verkeerd_adres'
      || r === 'verkocht_of_niet_relevant'
      || r === 'afgevallen';
}

export function isPositieveRespons(r: Responsstatus | null | undefined): boolean {
  return r === 'interesse'
      || r === 'wil_meer_informatie'
      || r === 'gesprek_gepland';
}

export function badgeClassVoorRespons(r: Responsstatus | null | undefined): string {
  if (!r) return 'bg-muted/40 text-muted-foreground border-border';
  if (isPositieveRespons(r)) return 'bg-success/10 text-success border-success/25';
  if (isNegatieveRespons(r)) return 'bg-destructive/10 text-destructive border-destructive/25';
  if (r === 'reactie_ontvangen' || r === 'later_opnieuw_benaderen')
    return 'bg-accent/15 text-accent-foreground border-accent/30';
  return 'bg-muted/40 text-muted-foreground border-border';
}
