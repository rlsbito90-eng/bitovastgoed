// Brother P-touch adreslabels — CSV-export builder.
// Puur en deterministisch: bouwt uit reeds definitief vastgelegde
// geadresseerde-/adresvelden van een off-market brief exact vier
// labelregels + een oplopend volgnummer. Geen kadasterlogica, geen
// verzendlogica; geen nieuwe interpretatie of deduplicatie.

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import {
  isSpecifiekeAanhef,
  plaatsBovenkast,
} from '@/lib/offMarket/acquisitie/adreslabel';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export interface BrotherLabelRij {
  nummer: number;
  regel1: string;
  regel2: string;
  regel3: string;
  regel4: string;
  /** Stabiele bron voor sortering/traceerbaarheid. */
  briefId: string;
  geadresseerdeLabel: string;
  /** True wanneer de rij geldig is (volledige NAW). */
  geldig: boolean;
  /** Concrete blokkadereden (NL) — `null` wanneer geldig. */
  blokkadeReden: string | null;
}

export interface BrotherBrief {
  id: string;
  eigenaar_naam: string | null;
  eigenaar_bedrijfsnaam: string | null;
  verzendadres: string | null;
  aanhef?: string | null;
}

// ---------------------------------------------------------------------
// Adresparser — herkent zowel NL- als buitenlandse adressen.
// ---------------------------------------------------------------------
const NL_POSTCODE_RE = /\b(\d{4})\s*([A-Za-z]{2})\b/;

export interface BrotherAdres {
  straat: string;
  postcodePlaats: string; // "1015 NC AMSTERDAM" of "8800-357 TAVIRA"
  land: string | null;    // null bij NL
}

/** Splits een verzendadres in nette regels (trim, collapse witruimte). */
function splitsRegels(adres: string): string[] {
  return adres
    .replace(/\r/g, '')
    .split('\n')
    .map(r => r.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function parseVerzendadresBrother(
  adres: string | null | undefined,
): BrotherAdres | null {
  if (!adres) return null;
  const regels = splitsRegels(adres.toString());
  if (regels.length < 2) return null;

  // NL: laatste regel bevat NL-postcode.
  const laatste = regels[regels.length - 1];
  if (NL_POSTCODE_RE.test(laatste)) {
    const m = laatste.match(NL_POSTCODE_RE)!;
    const postcode = `${m[1]} ${m[2].toUpperCase()}`;
    const plaats = plaatsBovenkast(laatste.replace(NL_POSTCODE_RE, '').trim());
    if (!plaats) return null;
    const straatRegels = regels.slice(0, -1);
    const straat = straatRegels.join(' ').trim();
    if (!straat) return null;
    return { straat, postcodePlaats: `${postcode} ${plaats}`, land: null };
  }

  // Buitenland: laatste regel = land, één regel eerder = postcode+plaats.
  if (regels.length < 3) return null;
  const land = regels[regels.length - 1];
  const pcPlaatsRuw = regels[regels.length - 2];
  // Splitsen tussen postcode(-blok) en plaats. Buitenlandse postcodes
  // bevatten cijfers en soms letters/streepjes → nemen we ruw over.
  const buitenPcMatch = pcPlaatsRuw.match(/^(\S+(?:\s\S+)?)\s+(.+)$/);
  let postcodePlaats: string;
  if (buitenPcMatch) {
    const postcode = buitenPcMatch[1];
    const plaats = plaatsBovenkast(buitenPcMatch[2]);
    postcodePlaats = `${postcode} ${plaats}`.trim();
  } else {
    postcodePlaats = plaatsBovenkast(pcPlaatsRuw);
  }
  const straat = regels.slice(0, -2).join(' ').trim();
  if (!straat || !postcodePlaats || !land) return null;
  return { straat, postcodePlaats, land };
}

// ---------------------------------------------------------------------
// Rij-builder
// ---------------------------------------------------------------------
export function bouwBrotherLabelRij(
  brief: BrotherBrief,
  nummer: number,
): BrotherLabelRij {
  const naam = (brief.eigenaar_naam ?? '').trim();
  const bedrijf = (brief.eigenaar_bedrijfsnaam ?? '').trim();
  const heeftPersoon = naam.length > 0;
  const heeftBedrijf = bedrijf.length > 0;
  const geadresseerdeLabel = naam || bedrijf || '(zonder geadresseerde)';

  if (!heeftPersoon && !heeftBedrijf) {
    return leegRij(brief.id, nummer, geadresseerdeLabel,
      'Geen naam of bedrijfsnaam bekend.');
  }

  const adres = parseVerzendadresBrother(brief.verzendadres);
  if (!adres) {
    return leegRij(brief.id, nummer, geadresseerdeLabel,
      'Postadres onvolledig of niet leesbaar.');
  }

  const persoon = heeftPersoon;
  const buitenland = adres.land !== null;

  let r1 = '';
  let r2 = '';
  let r3 = '';
  let r4 = '';

  if (persoon) {
    const specifiek = isSpecifiekeAanhef(brief.aanhef);
    const aanhef = specifiek ? brief.aanhef!.trim() : 'De heer/mevrouw';
    r1 = `${aanhef} ${naam}`.replace(/\s+/g, ' ').trim();
    r2 = adres.straat;
    r3 = adres.postcodePlaats;
    r4 = adres.land ?? '';
  } else {
    // Rechtspersoon
    if (buitenland) {
      // Buitenlandse rechtspersoon: land moet mee — laat "T.a.v. de directie"
      // vervallen om binnen vier regels te blijven.
      r1 = bedrijf;
      r2 = adres.straat;
      r3 = adres.postcodePlaats;
      r4 = adres.land ?? '';
    } else {
      r1 = bedrijf;
      r2 = 'T.a.v. de directie';
      r3 = adres.straat;
      r4 = adres.postcodePlaats;
    }
  }

  return {
    nummer, briefId: brief.id, geadresseerdeLabel,
    regel1: r1, regel2: r2, regel3: r3, regel4: r4,
    geldig: true, blokkadeReden: null,
  };
}

function leegRij(
  briefId: string, nummer: number, label: string, reden: string,
): BrotherLabelRij {
  return {
    nummer, briefId, geadresseerdeLabel: label,
    regel1: '', regel2: '', regel3: '', regel4: '',
    geldig: false, blokkadeReden: reden,
  };
}

// ---------------------------------------------------------------------
// CSV-serialisatie (RFC 4180) — komma-delimiter, CRLF, UTF-8 BOM.
// ---------------------------------------------------------------------
export const BROTHER_CSV_KOLOMMEN = [
  'Nummer', 'Regel1', 'Regel2', 'Regel3', 'Regel4',
] as const;

/** Quote een veld volgens RFC 4180 wanneer nodig. */
export function csvEscape(v: string | number): string {
  const s = v == null ? '' : String(v);
  // Verwijder eventuele interne regeleinden (mag niet in een label-veld).
  const veilig = s.replace(/[\r\n]+/g, ' ');
  if (/[",]/.test(veilig)) {
    return `"${veilig.replace(/"/g, '""')}"`;
  }
  return veilig;
}

/** Bouw de volledige CSV-tekst (excl. BOM). Regels afgesloten met CRLF. */
export function bouwBrotherCsv(rijen: BrotherLabelRij[]): string {
  const CRLF = '\r\n';
  const kop = BROTHER_CSV_KOLOMMEN.join(',');
  const body = rijen.map(r => [
    csvEscape(r.nummer),
    csvEscape(r.regel1),
    csvEscape(r.regel2),
    csvEscape(r.regel3),
    csvEscape(r.regel4),
  ].join(',')).join(CRLF);
  return `${kop}${CRLF}${body}${body ? CRLF : ''}`;
}

/** UTF-8 BOM voor Excel/P-touch compatibiliteit. */
export const UTF8_BOM = '\uFEFF';

/** Bestandsnaam volgens BUILD-spec. */
export function brotherCsvBestandsnaam(datum: Date = new Date()): string {
  const iso = datum.toISOString().slice(0, 10);
  return `bito-vastgoed-adreslabels-${iso}.csv`;
}

// ---------------------------------------------------------------------
// Mapping — brieven → labelrijen. Behoudt volgorde en duplicaten;
// past geen deduplicatie toe.
// ---------------------------------------------------------------------
export function brievenNaarBrotherRijen(
  brieven: Array<BrotherBrief | OffMarketBrief>,
): BrotherLabelRij[] {
  return brieven.map((b, i) => bouwBrotherLabelRij(b as BrotherBrief, i + 1));
}
