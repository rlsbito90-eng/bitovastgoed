// Adresnormalisatie + zoekvariantengenerator voor Kadaster Check V1.
// Pure functies. Geen externe afhankelijkheden, geen DB-calls.
//
// Strategie:
//  - bewaar altijd origineel adres inclusief toevoeging;
//  - splits huisnummer / toevoeging (160-H -> 160 + "H", 162-1 -> 162 + "1");
//  - genereer brede varianten (zonder toevoeging) eerst, exacte daarna;
//  - origineel als laatste fallback.
import type {
  AdresInput, ZoekVariant, AdresComplexiteit,
} from './_types.ts';

const POSTCODE_RE = /\b(\d{4})\s?([A-Za-z]{2})\b/;
// Patronen waarbij we huisnummer + toevoeging willen vangen:
//   "160-H", "160H", "162-1", "12 A", "12-bis"
const HUISNR_TOEVOEGING_RE = /\b(\d{1,5})(?:[\s\-]*([A-Za-z]{1,3}|\d{1,3}|bis|hs|huis))?\b/i;

/** Normaliseer postcode naar "1234 AB" met spatie en hoofdletters. */
export function normaliseerPostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/(\d{4})\s?([A-Z]{2})/);
  if (!m) return null;
  return `${m[1]} ${m[2]}`;
}

/** Splits huisnummer en toevoeging. "160-H" -> { huisnummer: "160", toevoeging: "H" }. */
export function splitHuisnummer(raw: string | null | undefined): { huisnummer: string | null; toevoeging: string | null } {
  if (!raw) return { huisnummer: null, toevoeging: null };
  const trimmed = String(raw).trim();
  const m = trimmed.match(HUISNR_TOEVOEGING_RE);
  if (!m) return { huisnummer: null, toevoeging: null };
  const huisnummer = m[1] ?? null;
  const toevoeging = m[2] ? m[2].toUpperCase() : null;
  return { huisnummer, toevoeging };
}

/**
 * Bouw een AdresInput uit losse velden + ruwe regel.
 * Als gestructureerde velden ontbreken proberen we ze uit de origineel-regel
 * af te leiden.
 */
export function normaliseerAdres(input: {
  origineel?: string | null;
  straat?: string | null;
  huisnummer?: string | null;
  toevoeging?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}): AdresInput {
  const origineel = (input.origineel ?? '').trim();

  let straat = input.straat?.trim() || null;
  let huisnummer = input.huisnummer?.trim() || null;
  let toevoeging = input.toevoeging?.trim()?.toUpperCase() || null;
  let postcode = normaliseerPostcode(input.postcode);
  let plaats = input.plaats?.trim() || null;

  // Postcode uit origineel halen indien nog leeg.
  if (!postcode && origineel) {
    const pm = origineel.match(POSTCODE_RE);
    if (pm) postcode = `${pm[1]} ${pm[2].toUpperCase()}`;
  }

  // Probeer straat + huisnummer uit origineel als nog leeg.
  if ((!straat || !huisnummer) && origineel) {
    // Verwijder postcode + plaats achter het adres om bij straat/huisnummer te komen.
    let rest = origineel;
    if (postcode) rest = rest.replace(POSTCODE_RE, '').trim();
    // Splits op laatste komma of dubbele spatie
    const stukken = rest.split(/[,]\s*/).map(s => s.trim()).filter(Boolean);
    const adresDeel = stukken[0] ?? rest;
    // Zoek huisnummer (+ toevoeging) in adresDeel
    const m = adresDeel.match(/^(.+?)\s+(\d{1,5})(?:[\s\-]*([A-Za-z]{1,3}|\d{1,3}|bis|hs|huis))?\b/i);
    if (m) {
      if (!straat) straat = m[1].trim();
      if (!huisnummer) huisnummer = m[2];
      if (!toevoeging && m[3]) toevoeging = m[3].toUpperCase();
    }
    // Plaats: alles na postcode of laatste stuk
    if (!plaats) {
      const naPostcode = origineel.split(POSTCODE_RE)?.pop()?.trim();
      if (naPostcode) plaats = naPostcode.replace(/^[,\s]+/, '').trim() || null;
      if (!plaats && stukken.length > 1) plaats = stukken[stukken.length - 1];
    }
  }

  // Als huisnummer nog samengesteld is ("160-H"), splits alsnog.
  if (huisnummer && /[^0-9]/.test(huisnummer)) {
    const s = splitHuisnummer(huisnummer);
    huisnummer = s.huisnummer;
    if (!toevoeging) toevoeging = s.toevoeging;
  }

  return {
    origineel,
    straat,
    huisnummer,
    toevoeging,
    postcode,
    plaats,
  };
}

/**
 * Detecteer complexe / onzekere adressen. Bij complex=true mag de UI
 * NOOIT automatisch een resultaat overnemen — gebruiker moet kiezen.
 */
export function detecteerComplexiteit(input: AdresInput): AdresComplexiteit {
  const redenen: string[] = [];

  if (!input.huisnummer) redenen.push('huisnummer_ontbreekt');
  if (!input.postcode && !input.plaats) redenen.push('postcode_en_plaats_ontbreken');
  if (!input.straat) redenen.push('straat_ontbreekt');

  // Meerdere huisnummers in origineel ("162 en 163", "12-14", "12, 14, 16")
  if (input.origineel) {
    if (/\b\d{1,5}\s+en\s+\d{1,5}\b/i.test(input.origineel)) redenen.push('meerdere_huisnummers');
    if (/\b\d{1,5}\s*[-/]\s*\d{1,5}\b/.test(input.origineel)) redenen.push('huisnummer_range');
    if (/(\d{1,5}\s*,\s*){1,}\d{1,5}/.test(input.origineel)) redenen.push('meerdere_huisnummers_komma');
  }

  // Kavel / appartementsrecht indicaties
  if (input.origineel && /\b(kavel|appartements?recht|complex|hoekpand)\b/i.test(input.origineel)) {
    redenen.push('kavel_of_appartementsrecht');
  }

  return { complex: redenen.length > 0, redenen };
}

/**
 * Bouw geordende zoekvarianten: breed → exact → origineel.
 * Hogere precisie = exacter (smaller). Varianten met onvoldoende data worden
 * automatisch overgeslagen.
 */
export function bouwZoekvarianten(adres: AdresInput): ZoekVariant[] {
  const varianten: ZoekVariant[] = [];
  const { straat, huisnummer, toevoeging, postcode, plaats, origineel } = adres;

  // 1. Breed: straat + huisnummer + plaats (zonder toevoeging)
  if (straat && huisnummer && plaats) {
    varianten.push({
      id: 'straat-huisnummer-plaats',
      label: `${straat} ${huisnummer}, ${plaats}`,
      precisie: 0.4,
      metToevoeging: false,
      query: { straat, huisnummer, plaats },
    });
  }

  // 2. Breed: postcode + huisnummer (zonder toevoeging)
  if (postcode && huisnummer) {
    varianten.push({
      id: 'postcode-huisnummer',
      label: `${postcode} ${huisnummer}`,
      precisie: 0.5,
      metToevoeging: false,
      query: { postcode, huisnummer },
    });
  }

  // 3. Volledig zonder toevoeging
  if (straat && huisnummer && postcode && plaats) {
    varianten.push({
      id: 'volledig-zonder-toevoeging',
      label: `${straat} ${huisnummer}, ${postcode} ${plaats}`,
      precisie: 0.6,
      metToevoeging: false,
      query: { straat, huisnummer, postcode, plaats },
    });
  }

  // 4. Exact: met toevoeging + plaats
  if (toevoeging && straat && huisnummer && plaats) {
    varianten.push({
      id: 'straat-huisnummer-toevoeging-plaats',
      label: `${straat} ${huisnummer}-${toevoeging}, ${plaats}`,
      precisie: 0.85,
      metToevoeging: true,
      query: { straat, huisnummer, toevoeging, plaats },
    });
  }

  // 5. Exact: postcode + huisnummer + toevoeging
  if (toevoeging && postcode && huisnummer) {
    varianten.push({
      id: 'postcode-huisnummer-toevoeging',
      label: `${postcode} ${huisnummer}-${toevoeging}`,
      precisie: 0.9,
      metToevoeging: true,
      query: { postcode, huisnummer, toevoeging },
    });
  }

  // 6. Fallback: originele regel
  if (origineel) {
    varianten.push({
      id: 'origineel',
      label: origineel,
      precisie: 0.3,
      metToevoeging: !!toevoeging,
      query: { vrij: origineel },
    });
  }

  return varianten;
}

