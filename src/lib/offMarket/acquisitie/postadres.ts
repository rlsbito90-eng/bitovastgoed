// Gedeelde vrije-tekst postadres-parser voor de Off-Market Acquisitieselectie.
//
// Doel: één centrale waarheid voor "is dit verzendadres volledig?" en voor
// het interpreteren van een multi-line adres in straat / postcode-plaats /
// land. Wordt gebruikt door zowel:
//   - `readiness.ts` (fase-bepaling, KPI's, badges)
//   - `bulkBrief.ts` (bulkkandidaat-geschiktheid)
//   - `brotherCsv.ts` (label-opbouw, uitsluitend voor labelweergave)
//
// Geen DB-aanroepen, geen Kadaster/BAG/AI. Volledig deterministisch.
//
// Regels
// ------
// NL-adres is volledig wanneer minimaal aanwezig zijn:
//   - straatregel met huisnummer (patroon `<letter><cijfer>`);
//   - Nederlandse postcode `1234 AB` (spatie optioneel);
//   - plaatsnaam op de postcoderegel.
//
// Buitenlands adres is volledig wanneer minimaal aanwezig zijn:
//   - >= 3 niet-lege adresregels;
//   - een niet-lege straat-/adresregel;
//   - een afzonderlijke postcode-/plaatsregel of andere inhoudelijke
//     plaatsregel (niet leeg, niet placeholder);
//   - een afsluitende landregel die niet leeg is, geen cijfers bevat,
//     geen NL-equivalent is en geen placeholderwaarde.
//
// Bewuste negatieve gevallen (blijven onvolledig):
//   - lege string / één adresregel;
//   - twee regels zonder NL-postcode en zonder herkenbaar land;
//   - alleen postcode/plaats + land, zonder straatregel;
//   - drie regels waarvan de laatste een postcode/cijferregel is
//     (geen herkenbare landregel);
//   - placeholderwaarden ("onbekend", "n.v.t.", "-", enz.).

const NL_POSTCODE_RE = /\b(\d{4})\s*([A-Za-z]{2})\b/;
const NL_STRAATNR_RE = /[A-Za-zÀ-ÿ.]\s*\d+/;

const NL_LAND_RE = /^(nederland|the\s+netherlands|netherlands|holland|nl|ned\.?)$/i;
const PLACEHOLDER_RE =
  /^(onbekend\.?|n\.?\s*v\.?\s*t\.?|geen|unknown|onduidelijk|-{1,}|—|–)$/i;

const HEEFT_CIJFER_RE = /\d/;
const MAX_LAND_LENGTE = 40;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export interface Postadres {
  /** Genormaliseerde niet-lege regels (whitespace gecollapsed, getrimd). */
  regels: string[];
  /** Straat-/adresregel(s), samengevoegd met spatie. */
  straat: string | null;
  /**
   * Combineerde postcode+plaats regel zoals bruikbaar op een label.
   * NL: `1234 AB PLAATS`. Buitenland: postcode + PLAATS bovenkast, of
   * enkel PLAATS wanneer geen postcode-blok herkenbaar is.
   */
  postcodePlaats: string | null;
  /** NL-postcode `1234 AB` genormaliseerd, of buitenlandse postcode ruw. */
  postcode: string | null;
  /** Plaatsnaam in bovenkast. */
  plaats: string | null;
  /** Landregel — `null` betekent Nederland. */
  land: string | null;
  isBuitenland: boolean;
  /** True wanneer het adres voldoet aan de volledigheidsregels. */
  volledig: boolean;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
export function splitAdresRegels(v: string): string[] {
  return v
    .replace(/\r/g, '')
    .split('\n')
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_RE.test(v.trim());
}

export function isNlLandRegel(v: string): boolean {
  return NL_LAND_RE.test(v.trim());
}

// ---------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------
export function parsePostadres(
  text: string | null | undefined,
): Postadres | null {
  if (!text) return null;
  const regels = splitAdresRegels(String(text));
  if (regels.length === 0) return null;
  if (regels.every(isPlaceholder)) return null;

  // ---- NL-pad --------------------------------------------------------
  // Zoek regel met NL-postcode (meestal de laatste).
  let nlIdx = -1;
  for (let i = regels.length - 1; i >= 0; i -= 1) {
    if (NL_POSTCODE_RE.test(regels[i])) {
      nlIdx = i;
      break;
    }
  }

  if (nlIdx >= 0) {
    // Wanneer ná de postcode nog een niet-NL landregel volgt, is dit géén
    // NL-adres → val terug op het buitenland-pad.
    const naPc = regels.slice(nlIdx + 1);
    const heeftBuitenlandsExtra = naPc.some(
      (r) => !isNlLandRegel(r) && !isPlaceholder(r),
    );
    if (!heeftBuitenlandsExtra) {
      const pcRegel = regels[nlIdx];
      const m = pcRegel.match(NL_POSTCODE_RE)!;
      const postcode = `${m[1]} ${m[2].toUpperCase()}`;
      const plaatsRuw = pcRegel.replace(NL_POSTCODE_RE, '').trim();
      const plaats = plaatsRuw ? plaatsRuw.toUpperCase() : null;
      const straatRegels = regels
        .slice(0, nlIdx)
        .filter((r) => !isPlaceholder(r));
      const straat = straatRegels.join(' ').trim() || null;
      const heeftStraatNummer = !!straat && NL_STRAATNR_RE.test(straat);
      const volledig = !!straat && !!plaats && heeftStraatNummer;
      return {
        regels,
        straat,
        postcodePlaats: plaats ? `${postcode} ${plaats}` : postcode,
        postcode,
        plaats,
        land: null,
        isBuitenland: false,
        volledig,
      };
    }
  }

  // ---- Buitenland-pad -----------------------------------------------
  if (regels.length < 3) return null;

  const land = regels[regels.length - 1];
  if (isPlaceholder(land)) return null;
  if (isNlLandRegel(land)) return null;
  // Een landregel bevat geen cijfers en is geen lange doorloop.
  if (HEEFT_CIJFER_RE.test(land)) return null;
  if (land.length > MAX_LAND_LENGTE) return null;

  const pcPlaatsRegel = regels[regels.length - 2];
  if (isPlaceholder(pcPlaatsRegel)) return null;
  if (pcPlaatsRegel.length < 2) return null;

  const straatRegels = regels
    .slice(0, -2)
    .filter((r) => !isPlaceholder(r));
  if (straatRegels.length === 0) return null;
  const straat = straatRegels.join(' ').trim();
  if (!straat) return null;

  // Splits postcode/plaats — als eerste token een cijfer bevat is dat de
  // buitenlandse postcode; anders is de hele regel de plaatsnaam.
  const buitenPcMatch = pcPlaatsRegel.match(/^(\S+(?:\s\S+)?)\s+(.+)$/);
  let postcode: string | null = null;
  let plaats: string;
  let postcodePlaats: string;
  if (buitenPcMatch && /\d/.test(buitenPcMatch[1])) {
    postcode = buitenPcMatch[1];
    plaats = buitenPcMatch[2].toUpperCase();
    postcodePlaats = `${postcode} ${plaats}`;
  } else {
    plaats = pcPlaatsRegel.toUpperCase();
    postcodePlaats = plaats;
  }

  return {
    regels,
    straat,
    postcodePlaats,
    postcode,
    plaats,
    land,
    isBuitenland: true,
    volledig: true,
  };
}

/**
 * True wanneer het opgegeven verzendadres voldoet aan de centrale
 * volledigheidsregels (NL of buitenland).
 */
export function isVolledigPostadres(
  text: string | null | undefined,
): boolean {
  const p = parsePostadres(text);
  return !!p && p.volledig;
}
