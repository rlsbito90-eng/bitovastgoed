// Responsstatussen voor off-market brieven (per geadresseerde).
// UI-labels strikt Nederlands.
import type { OffMarketEigenaarstatus, OffMarketStatus } from '@/lib/offMarket/types';

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

/** Korte uitleg in de registratieflow; maakt het verschil tussen uitkomst en processtap expliciet. */
export const RESPONS_UITLEG: Partial<Record<Responsstatus, string>> = {
  reactie_ontvangen: 'Gebruik dit alleen wanneer de reactie nog niet inhoudelijk is beoordeeld.',
  interesse: 'De eigenaar toont concrete interesse in een gesprek of verkoop.',
  wil_meer_informatie: 'De eigenaar wil eerst aanvullende informatie ontvangen.',
  gesprek_gepland: 'Er is een concreet gesprek of afspraak gepland.',
  later_opnieuw_benaderen: 'Nu geen verkoopmoment, maar later opnieuw contact is logisch.',
  niet_geinteresseerd: 'De eigenaar geeft aan geen interesse te hebben in verkoop of verder contact.',
  verkeerd_adres: 'De geadresseerde of het correspondentieadres blijkt niet juist.',
  retour_post: 'De brief is retour gekomen; eigenaar/adres moet opnieuw worden onderzocht.',
  verkocht_of_niet_relevant: 'Het object is verkocht of het signaal is niet langer relevant.',
  afgevallen: 'Het dossier valt inhoudelijk af voor verdere acquisitie.',
  geen_reactie: 'Er is na de gekozen opvolgtermijn geen reactie ontvangen.',
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

/** Bij deze respons is een expliciete toekomstige actie meestal gewenst. */
export function responsAdviseertVervolgtaak(r: Responsstatus | null | undefined): boolean {
  return r === 'later_opnieuw_benaderen'
      || r === 'wil_meer_informatie'
      || r === 'gesprek_gepland';
}

const STATUS_RANG: Partial<Record<OffMarketStatus, number>> = {
  nieuw_signaal: 0,
  interessant: 1,
  twijfel: 1,
  te_onderzoeken: 2,
  eigenaar_achterhalen: 3,
  eigenaar_gevonden: 4,
  benaderen: 5,
  benaderd: 6,
  in_gesprek: 7,
  aanbod_ontvangen: 8,
  object_ontvangen: 9,
  dealtraject: 10,
};

/**
 * Bepaalt welke procesvelden logisch uit de geregistreerde reactie volgen.
 * De eigenaarstatus blijft identificatiegericht: onbekend / onderzoeken / gevonden.
 * Een positieve of neutrale respons mag een verder gevorderd dossier nooit terugzetten.
 */
export function procesPatchVoorRespons(
  respons: Responsstatus,
  huidigeStatus?: OffMarketStatus | null,
  huidigeEigenaarstatus?: OffMarketEigenaarstatus | null,
): { status?: OffMarketStatus; eigenaarstatus?: OffMarketEigenaarstatus } {
  const patch: { status?: OffMarketStatus; eigenaarstatus?: OffMarketEigenaarstatus } = {};

  if (respons === 'verkeerd_adres' || respons === 'retour_post') {
    patch.status = 'eigenaar_achterhalen';
    patch.eigenaarstatus = 'te_onderzoeken';
    return patch;
  }

  // Zodra er een echte inhoudelijke reactie is, is de eigenaar per definitie bekend.
  // Ook oude procesachtige eigenaarstatussen worden hiermee genormaliseerd naar 'gevonden'.
  if (respons !== 'geen_reactie') {
    patch.eigenaarstatus = 'gevonden';
  } else if (!huidigeEigenaarstatus || huidigeEigenaarstatus === 'onbekend' || huidigeEigenaarstatus === 'te_onderzoeken') {
    patch.eigenaarstatus = 'gevonden';
  }

  if (respons === 'niet_geinteresseerd' || respons === 'verkocht_of_niet_relevant' || respons === 'afgevallen') {
    patch.status = 'afgevallen';
    return patch;
  }

  const gewenst: OffMarketStatus = isPositieveRespons(respons) ? 'in_gesprek' : 'benaderd';
  const huidigeRang = huidigeStatus ? (STATUS_RANG[huidigeStatus] ?? -1) : -1;
  const gewensteRang = STATUS_RANG[gewenst] ?? -1;
  if (huidigeRang < gewensteRang) patch.status = gewenst;

  return patch;
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
