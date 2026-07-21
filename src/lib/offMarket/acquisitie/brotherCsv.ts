// Brother P-touch adreslabels — CSV-export builder.
// Puur en deterministisch: bouwt uit reeds definitief vastgelegde
// geadresseerde-/adresvelden van een off-market brief exact vier
// labelregels + een oplopend volgnummer. Geen kadasterlogica, geen
// verzendlogica; geen nieuwe interpretatie of deduplicatie.

import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { plaatsBovenkast } from '@/lib/offMarket/acquisitie/adreslabel';
import { parsePostadres } from '@/lib/offMarket/acquisitie/postadres';

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
// Adres-adapter — labelweergave voor Brother P-touch.
// De inhoudelijke parsing (NL vs buitenland, volledigheid) gebeurt in de
// gedeelde module `postadres.ts`. Deze adapter zet het resultaat om naar
// de shape die de bestaande Brother-tests en label-opbouw verwachten.
// ---------------------------------------------------------------------
export interface BrotherAdres {
  straat: string;
  postcodePlaats: string; // "1015 NC AMSTERDAM" of "8800-357 TAVIRA"
  land: string | null;    // null bij NL
}

export function parseVerzendadresBrother(
  adres: string | null | undefined,
): BrotherAdres | null {
  const p = parsePostadres(adres);
  if (!p) return null;
  if (!p.straat || !p.postcodePlaats) return null;
  // Voor labelweergave forceren we de plaats in bovenkast (idempotent op
  // reeds bovenkast-strings).
  return {
    straat: p.straat,
    postcodePlaats: plaatsBovenkast(p.postcodePlaats),
    land: p.land,
  };
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
    // Regel1 = uitsluitend de definitieve geadresseerdennaam. Nooit een
    // briefaanhef (opgeslagen `aanhef` of generieke "De heer/mevrouw")
    // meenemen — een adreslabel is geen brief.
    r1 = naam;
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
