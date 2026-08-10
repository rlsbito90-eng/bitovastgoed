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

/**
 * Een echte respons neemt de plaats in van de standaard "geen reactie"-opvolging
 * die bij de brief is aangemaakt. `geen_reactie` is juist onderdeel van die oude
 * opvolgroute en mag de gekoppelde taak daarom niet automatisch afronden.
 */
export function responsVervangtStandaardOpvolging(
  r: Responsstatus | null | undefined,
): boolean {
  return !!r && r !== 'geen_reactie';
}

export function badgeClassVoorRespons(r: Responsstatus | null | undefined): string {
  const leesbaar = '!text-xs font-semibold';
  if (!r) return `${leesbaar} bg-muted/40 text-muted-foreground border-border`;
  if (isPositieveRespons(r)) return `${leesbaar} bg-success/15 text-success border-success/35`;
  if (isNegatieveRespons(r)) return `${leesbaar} bg-destructive/15 text-destructive border-destructive/35`;
  if (r === 'reactie_ontvangen' || r === 'later_opnieuw_benaderen')
    return `${leesbaar} bg-accent/25 text-foreground border-accent/45`;
  return `${leesbaar} bg-muted/40 text-muted-foreground border-border`;
}
