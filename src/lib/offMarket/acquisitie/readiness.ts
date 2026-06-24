// V1B — Pure readiness-helper voor de Off-Market Acquisitieselectie.
//
// Volledig afgeleid (niet opgeslagen). Werkt op de bestaande canonieke
// bronnen: off_market_signalen + niet-gearchiveerde off_market_brieven.
// Geadresseerden worden gededupliceerd via de bestaande `geadresseerdeKey()`
// uit `@/lib/offMarket/brieven/geadresseerdeKey`, met fallback op de
// eigenaargegevens op het signaal wanneer er nog geen brieven zijn.
//
// Deze helper roept GEEN Kadaster, BAG, AI, PDF of brief-create aan.
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { geadresseerdeKey } from '@/lib/offMarket/brieven/geadresseerdeKey';

// ---------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------
export type ReadinessFase =
  | 'onderzoek_nodig'
  | 'eigenaar_ontbreekt'
  | 'adres_ontbreekt'
  | 'brief_voorbereiden'
  | 'concept_gereed'
  | 'gereed_voor_print'
  | 'geprint'
  | 'gepost'
  | 'email_verzonden'
  | 'opvolging_open'
  | 'afgerond';

export interface ReadinessFaseInfo {
  fase: ReadinessFase;
  label: string;
  reden: string;
  /** Eerstvolgende voorgestelde actie (verwijst naar bestaande UI). */
  volgendeActie: string;
  status: 'geblokkeerd' | 'gereed' | 'in_behandeling' | 'afgehandeld';
}

const FASE_DEFS: Record<ReadinessFase, ReadinessFaseInfo> = {
  onderzoek_nodig: {
    fase: 'onderzoek_nodig',
    label: 'Onderzoek nodig',
    reden: 'Signaal heeft nog geen eigenaarsonderzoek.',
    volgendeActie: 'Open signaal voor eigenaarsonderzoek',
    status: 'geblokkeerd',
  },
  eigenaar_ontbreekt: {
    fase: 'eigenaar_ontbreekt',
    label: 'Eigenaar ontbreekt',
    reden: 'Geen geldige eigenaar/geadresseerde gekoppeld.',
    volgendeActie: 'Vul eigenaar in op het signaal',
    status: 'geblokkeerd',
  },
  adres_ontbreekt: {
    fase: 'adres_ontbreekt',
    label: 'Adres ontbreekt',
    reden: 'Postadres van de geadresseerde is onvolledig.',
    volgendeActie: 'Vul verzendadres aan',
    status: 'geblokkeerd',
  },
  brief_voorbereiden: {
    fase: 'brief_voorbereiden',
    label: 'Brief voorbereiden',
    reden: 'Eigenaar en adres bekend; nog geen concept aanwezig.',
    volgendeActie: 'Open signaal en voorbereid brief',
    status: 'gereed',
  },
  concept_gereed: {
    fase: 'concept_gereed',
    label: 'Concept aanwezig',
    reden: 'Conceptbrief aanwezig; adres nog niet bevestigd compleet.',
    volgendeActie: 'Controleer verzendadres in conceptbrief',
    status: 'in_behandeling',
  },
  gereed_voor_print: {
    fase: 'gereed_voor_print',
    label: 'Klaar voor print',
    reden: 'Concept met volledig postadres.',
    volgendeActie: 'Brief afdrukken vanuit signaal',
    status: 'gereed',
  },
  geprint: {
    fase: 'geprint',
    label: 'Geprint',
    reden: 'Brief is geprint; wacht op posten.',
    volgendeActie: 'Markeer als gepost',
    status: 'in_behandeling',
  },
  gepost: {
    fase: 'gepost',
    label: 'Gepost',
    reden: 'Brief is gepost; opvolging staat klaar.',
    volgendeActie: 'Wacht op respons of opvolg',
    status: 'in_behandeling',
  },
  opvolging_open: {
    fase: 'opvolging_open',
    label: 'Opvolging open',
    reden: 'Opvolgdatum bereikt zonder respons.',
    volgendeActie: 'Voer opvolging uit',
    status: 'in_behandeling',
  },
  afgerond: {
    fase: 'afgerond',
    label: 'Afgerond',
    reden: 'Signaal is afgehandeld of buiten scope.',
    volgendeActie: 'Verwijder uit selectie',
    status: 'afgehandeld',
  },
};

export const FASE_VOLGORDE: ReadinessFase[] = [
  'onderzoek_nodig', 'eigenaar_ontbreekt', 'adres_ontbreekt',
  'brief_voorbereiden', 'concept_gereed', 'gereed_voor_print',
  'geprint', 'gepost', 'opvolging_open', 'afgerond',
];

export function faseInfo(fase: ReadinessFase): ReadinessFaseInfo {
  return FASE_DEFS[fase];
}

// ---------------------------------------------------------------------
// Waarschuwingen
// ---------------------------------------------------------------------
export type ReadinessWaarschuwing =
  | 'bag_meerdere_matches'
  | 'bag_geen_match'
  | 'bag_niet_verrijkt'
  | 'kadaster_ontbreekt'
  | 'ai_ontbreekt'
  | 'ai_lage_score'
  | 'meerdere_geadresseerden'
  | 'opvolgtaak_ontbreekt';

export const WAARSCHUWING_LABEL: Record<ReadinessWaarschuwing, string> = {
  bag_meerdere_matches: 'BAG: meerdere matches',
  bag_geen_match: 'BAG: geen match',
  bag_niet_verrijkt: 'BAG: niet verrijkt',
  kadaster_ontbreekt: 'Kadasteradvies ontbreekt',
  ai_ontbreekt: 'AI ontbreekt',
  ai_lage_score: 'Lage AI-score',
  meerdere_geadresseerden: 'Meerdere geadresseerden',
  opvolgtaak_ontbreekt: 'Opvolgtaak ontbreekt',
};

// ---------------------------------------------------------------------
// Geadresseerden
// ---------------------------------------------------------------------
export interface GeadresseerdeReadiness {
  key: string;
  naam: string | null;
  bedrijfsnaam: string | null;
  verzendadres: string | null;
  volledigPostadres: boolean;
  /** Meest gevorderde niet-gearchiveerde brief van deze geadresseerde. */
  laatsteBrief: OffMarketBrief | null;
  heeftActiefConcept: boolean;
  heeftVerstuurd: boolean;
  heeftGeprint: boolean;
  heeftGepost: boolean;
  opvolgingOpen: boolean;
  responsBinnen: boolean;
  geblokkeerd: boolean;
}

/**
 * Valideer of een verzendadres bruikbaar is voor fysieke post.
 * Eis: minimaal een NL-postcode en een plaatsnaam zichtbaar in de tekst.
 */
export function isVolledigPostadres(adres: string | null | undefined): boolean {
  if (!adres) return false;
  const norm = adres.replace(/\s+/g, ' ').trim();
  if (norm.length < 8) return false;
  const heeftPostcode = /\b\d{4}\s?[A-Za-z]{2}\b/.test(norm);
  const heeftStraatNummer = /[A-Za-zÀ-ÿ.]\s*\d+/.test(norm);
  return heeftPostcode && heeftStraatNummer;
}

function nuISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOpvolgingOpen(b: OffMarketBrief, vandaag = nuISO()): boolean {
  const opv = (b as any).opvolgdatum as string | null | undefined;
  if (!opv) return false;
  const respons = (b as any).responsstatus as string | null | undefined;
  if (respons && respons !== 'geen_reactie') return false;
  return opv <= vandaag;
}

/** Verzendstatus-rang voor "verst gevorderd" berekening. */
const VERZEND_RANG: Record<string, number> = {
  concept: 0,
  pdf_gegenereerd: 1,
  geprint: 2,
  in_envelop: 3,
  gepost: 4,
  verzonden: 4,
};

/**
 * Leid geadresseerden af voor één signaal. Dedupe op `geadresseerde_key`
 * (bestaande projectfunctie) met fallback voor oude brieven zonder key.
 * Wanneer er geen actieve brieven zijn én het signaal heeft eigenaar-
 * informatie, wordt één virtuele geadresseerde geretourneerd zodat de
 * fase 'brief_voorbereiden' / 'adres_ontbreekt' bepaald kan worden.
 */
export function geadresseerdenVoorSignaal(
  signaal: OffMarketSignaal,
  brieven: OffMarketBrief[],
): GeadresseerdeReadiness[] {
  const actief = brieven.filter(b => !b.archived_at);
  const perKey = new Map<string, OffMarketBrief[]>();
  for (const b of actief) {
    const k = b.geadresseerde_key ?? geadresseerdeKey(b);
    const arr = perKey.get(k) ?? [];
    arr.push(b);
    perKey.set(k, arr);
  }

  const out: GeadresseerdeReadiness[] = [];
  for (const [key, lijst] of perKey.entries()) {
    const refSorted = [...lijst].sort((a, b) =>
      (b.updated_at ?? b.created_at ?? '').localeCompare(
        a.updated_at ?? a.created_at ?? '',
      ));
    const ref = refSorted[0];
    const verstuurd = lijst.filter(b => b.status === 'verstuurd');
    const concepten = lijst.filter(b => b.status === 'concept');
    const verstgeprint = lijst.some(b => {
      const v = (b.verzendstatus ?? '') as string;
      return v === 'geprint' || v === 'in_envelop';
    });
    const verstgepost = lijst.some(b => {
      const v = (b.verzendstatus ?? '') as string;
      return v === 'gepost' || v === 'verzonden';
    }) || verstuurd.length > 0;
    const opvolgOpen = lijst.some(b => isOpvolgingOpen(b));
    const responsBinnen = lijst.some(b => {
      const r = (b as any).responsstatus as string | null | undefined;
      return !!r && r !== 'geen_reactie';
    });

    // Sterkste laatste brief = hoogste verzendstatus, tie-break op updated_at.
    const sorted = [...lijst].sort((a, b) => {
      const ra = VERZEND_RANG[(a.verzendstatus ?? 'concept') as string] ?? 0;
      const rb = VERZEND_RANG[(b.verzendstatus ?? 'concept') as string] ?? 0;
      if (ra !== rb) return rb - ra;
      return (b.updated_at ?? b.created_at ?? '').localeCompare(
        a.updated_at ?? a.created_at ?? '',
      );
    });

    out.push({
      key,
      naam: ref.eigenaar_naam ?? null,
      bedrijfsnaam: ref.eigenaar_bedrijfsnaam ?? null,
      verzendadres: ref.verzendadres ?? null,
      volledigPostadres: isVolledigPostadres(ref.verzendadres),
      laatsteBrief: sorted[0] ?? null,
      heeftActiefConcept: concepten.length > 0 && verstuurd.length === 0,
      heeftVerstuurd: verstuurd.length > 0,
      heeftGeprint: verstgeprint,
      heeftGepost: verstgepost,
      opvolgingOpen: opvolgOpen,
      responsBinnen,
      geblokkeerd: false,
    });
  }

  if (out.length === 0) {
    const a = signaal as any;
    const naam = (a.eigenaar_naam ?? '').toString().trim();
    const bedrijf = (a.eigenaar_bedrijfsnaam ?? '').toString().trim();
    const adres = (a.eigenaar_verzendadres ?? a.eigenaar_adres ?? null) as string | null;
    if (naam || bedrijf) {
      out.push({
        key: `_signaal|${signaal.id}`,
        naam: naam || null,
        bedrijfsnaam: bedrijf || null,
        verzendadres: adres,
        volledigPostadres: isVolledigPostadres(adres),
        laatsteBrief: null,
        heeftActiefConcept: false,
        heeftVerstuurd: false,
        heeftGeprint: false,
        heeftGepost: false,
        opvolgingOpen: false,
        responsBinnen: false,
        geblokkeerd: false,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Telling
// ---------------------------------------------------------------------
export interface GeadresseerdenTelling {
  totaal: number;
  metVolledigAdres: number;
  metActiefConcept: number;
  gereedVoorPrint: number;
  geprintOfGepost: number;
  geblokkeerd: number;
}

export function tellGeadresseerden(g: GeadresseerdeReadiness[]): GeadresseerdenTelling {
  let metVolledigAdres = 0, metActiefConcept = 0, gereedVoorPrint = 0;
  let geprintOfGepost = 0, geblokkeerd = 0;
  for (const x of g) {
    if (x.volledigPostadres) metVolledigAdres += 1;
    if (x.heeftActiefConcept) metActiefConcept += 1;
    if (x.heeftActiefConcept && x.volledigPostadres && !x.heeftGeprint && !x.heeftGepost) {
      gereedVoorPrint += 1;
    }
    if (x.heeftGeprint || x.heeftGepost) geprintOfGepost += 1;
    if (!x.volledigPostadres && !(x.naam || x.bedrijfsnaam)) geblokkeerd += 1;
  }
  return {
    totaal: g.length,
    metVolledigAdres, metActiefConcept,
    gereedVoorPrint, geprintOfGepost, geblokkeerd,
  };
}

// ---------------------------------------------------------------------
// Fase per signaal
// ---------------------------------------------------------------------
const AFGEROND_SIGNAAL_STATUS = new Set<string>(['archief', 'afgevallen', 'niet_interessant']);

export interface SignaalReadiness {
  fase: ReadinessFase;
  info: ReadinessFaseInfo;
  geadresseerden: GeadresseerdeReadiness[];
  telling: GeadresseerdenTelling;
  waarschuwingen: ReadinessWaarschuwing[];
  /** Korte machine-bron voor primaire blokkadereden, indien van toepassing. */
  blokkadeReden: string | null;
}

export interface BepaalReadinessInput {
  signaal: OffMarketSignaal;
  brieven: OffMarketBrief[];
}

export function bepaalSignaalReadiness({ signaal, brieven }: BepaalReadinessInput): SignaalReadiness {
  const a = signaal as any;
  const status = (signaal.status ?? '') as string;
  const geadresseerden = geadresseerdenVoorSignaal(signaal, brieven);
  const telling = tellGeadresseerden(geadresseerden);

  // Waarschuwingen — nooit blokkerend.
  const waarschuwingen: ReadinessWaarschuwing[] = [];
  const bag = (a.bag_status ?? null) as string | null;
  if (!bag) waarschuwingen.push('bag_niet_verrijkt');
  else if (bag === 'meerdere_matches') waarschuwingen.push('bag_meerdere_matches');
  else if (bag === 'geen_match') waarschuwingen.push('bag_geen_match');
  const aiScore = typeof a.ai_score === 'number' ? a.ai_score as number : null;
  if (aiScore == null) waarschuwingen.push('ai_ontbreekt');
  else if (aiScore < 50) waarschuwingen.push('ai_lage_score');
  if (geadresseerden.length > 1) waarschuwingen.push('meerdere_geadresseerden');
  if (geadresseerden.some(g => g.heeftGepost) && !geadresseerden.some(g => g.opvolgingOpen)) {
    const heeftOpvolgdatum = brieven.some(b => !!(b as any).opvolgdatum);
    if (!heeftOpvolgdatum) waarschuwingen.push('opvolgtaak_ontbreekt');
  }

  // Fase-beslisboom.
  let fase: ReadinessFase;
  let blokkadeReden: string | null = null;

  if (AFGEROND_SIGNAAL_STATUS.has(status)) {
    fase = 'afgerond';
  } else if (geadresseerden.length === 0) {
    if (status === 'te_onderzoeken' || status === 'nieuw_signaal' || status === 'twijfel') {
      fase = 'onderzoek_nodig';
      blokkadeReden = 'Signaal staat nog in onderzoek.';
    } else {
      fase = 'eigenaar_ontbreekt';
      blokkadeReden = 'Geen geadresseerde gevonden.';
    }
  } else if (geadresseerden.every(g => !g.volledigPostadres && !g.heeftActiefConcept && !g.heeftVerstuurd)) {
    fase = 'adres_ontbreekt';
    blokkadeReden = 'Geen geadresseerde heeft een volledig postadres.';
  } else if (geadresseerden.every(g => g.responsBinnen && g.heeftVerstuurd)) {
    fase = 'afgerond';
  } else if (geadresseerden.some(g => g.opvolgingOpen)) {
    fase = 'opvolging_open';
  } else if (geadresseerden.some(g => g.heeftGepost)) {
    fase = 'gepost';
  } else if (geadresseerden.some(g => g.heeftGeprint)) {
    fase = 'geprint';
  } else if (geadresseerden.some(g => g.heeftActiefConcept && g.volledigPostadres)) {
    fase = 'gereed_voor_print';
  } else if (geadresseerden.some(g => g.heeftActiefConcept)) {
    fase = 'concept_gereed';
  } else {
    // Eigenaar + adres aanwezig, geen concept → voorbereiden.
    const heeftWerkbare = geadresseerden.some(g =>
      g.volledigPostadres && (g.naam || g.bedrijfsnaam));
    if (heeftWerkbare) {
      fase = 'brief_voorbereiden';
    } else {
      fase = 'adres_ontbreekt';
      blokkadeReden = 'Postadres ontbreekt voor alle geadresseerden.';
    }
  }

  return {
    fase,
    info: FASE_DEFS[fase],
    geadresseerden,
    telling,
    waarschuwingen,
    blokkadeReden,
  };
}

// ---------------------------------------------------------------------
// Aggregatie over selectie
// ---------------------------------------------------------------------
export interface AcquisitieKpis {
  signalen: number;
  geadresseerden: number;
  printklaar: number;
  geblokkeerd: number;
  opvolgingOpen: number;
  afgerond: number;
}

export function aggregeerKpis(rs: SignaalReadiness[]): AcquisitieKpis {
  let geadresseerden = 0, printklaar = 0, geblokkeerd = 0, opvolg = 0, afgerond = 0;
  for (const r of rs) {
    geadresseerden += r.geadresseerden.length;
    if (r.fase === 'gereed_voor_print') printklaar += 1;
    if (r.info.status === 'geblokkeerd') geblokkeerd += 1;
    if (r.fase === 'opvolging_open') opvolg += 1;
    if (r.fase === 'afgerond') afgerond += 1;
  }
  return {
    signalen: rs.length,
    geadresseerden, printklaar, geblokkeerd,
    opvolgingOpen: opvolg, afgerond,
  };
}

// ---------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------
export type SelectieFilter = 'alles' | 'geblokkeerd' | 'brief_voorbereiden' | 'printklaar' | 'opvolging';

export function pastInFilter(r: SignaalReadiness, f: SelectieFilter): boolean {
  switch (f) {
    case 'alles': return true;
    case 'geblokkeerd': return r.info.status === 'geblokkeerd';
    case 'brief_voorbereiden':
      return r.fase === 'brief_voorbereiden' || r.fase === 'concept_gereed';
    case 'printklaar': return r.fase === 'gereed_voor_print';
    case 'opvolging': return r.fase === 'opvolging_open';
  }
}
