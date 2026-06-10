// Genormaliseerde viewmodel-mapper voor Kadaster Rechten/Eigendomsinformatie.
//
// Het Kadaster-bericht bevat in de praktijk meerdere "rechtenblokken":
// Eigendom, Erfpacht, Opstal, Appartementsrecht, ... met per blok één of
// meerdere rechthebbenden (natuurlijk persoon of rechtspersoon), aandeel,
// adres, eventuele KvK/zetel en een registerverwijzing
// (bijv. "Register Hyp4 Deel … nummer …").
//
// Deze mapper:
//   - Probeert defensief meerdere veldnamen.
//   - Crasht nooit op onbekende of geneste shapes.
//   - Wordt alleen gebruikt voor weergave; geen automatische CRM-koppeling.

export type KadasterRechtenBron = 'json' | 'pdf_available' | 'unknown';

export interface KadasterRechtenBlok {
  id: string;
  rechtstype: string | null;     // bv. "Eigendom (recht van)"
  aandeel: string | null;        // bv. "1/1"
  naam: string | null;           // natuurlijke persoon
  bedrijfsnaam: string | null;   // rechtspersoon
  persoonType: 'natuurlijk' | 'rechtspersoon' | null;
  geboortedatum: string | null;
  geboorteplaats: string | null;
  adresRegels: string[];         // straat + huisnummer, postbus
  postcode: string | null;
  plaats: string | null;
  zetel: string | null;
  kvkNummer: string | null;
  registerVerwijzing: string | null;
  kadastraleAanduiding: string | null;
  bron: KadasterRechtenBron;
}

// ─── helpers ──────────────────────────────────────────────────────────────
function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>) : null;
}
function asStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}
function leesStr(obj: unknown, ...keys: string[]): string | null {
  const o = asObj(obj); if (!o) return null;
  for (const k of keys) {
    const s = asStr(o[k]);
    if (s) return s;
  }
  return null;
}
function leesAandeel(v: unknown): string | null {
  if (v == null) return null;
  const s = asStr(v); if (s) return s;
  const o = asObj(v); if (!o) return null;
  const t = o.teller, n = o.noemer;
  if (typeof t === 'number' && typeof n === 'number' && n !== 0) return `${t}/${n}`;
  return leesStr(o, 'omschrijving', 'tekst', 'value');
}

const RECHTSTYPE_TREFWOORDEN: Array<[RegExp, string]> = [
  [/appartementsrecht/i, 'Appartementsrecht'],
  [/erfpacht/i,          'Erfpacht (recht van)'],
  [/opstal/i,            'Opstal (recht van)'],
  [/vruchtgebruik/i,     'Vruchtgebruik (recht van)'],
  [/gebruik en bewoning/i, 'Gebruik en bewoning'],
  [/eigendom/i,          'Eigendom (recht van)'],
];
function normaliseerRechtstype(raw: string | null): string | null {
  if (!raw) return null;
  for (const [re, label] of RECHTSTYPE_TREFWOORDEN) if (re.test(raw)) return label;
  return raw;
}

function leesRechtstype(obj: Record<string, unknown>): string | null {
  return normaliseerRechtstype(
    leesStr(obj, 'rechtsoort', 'soortRecht', 'aardRecht', 'aardRechtVerkort',
      'omschrijvingRecht', 'zakelijkRecht', 'recht', 'titel', 'omschrijving'),
  );
}

function leesAdresRegels(obj: Record<string, unknown>): {
  regels: string[]; postcode: string | null; plaats: string | null;
} {
  const adres = asObj(obj.adres) ?? asObj((obj as Record<string, unknown>).woonadres)
    ?? asObj((obj as Record<string, unknown>).vestigingsadres)
    ?? asObj((obj as Record<string, unknown>).correspondentieadres);
  const bron = adres ?? obj;
  const straat = leesStr(bron, 'straat', 'straatnaam', 'openbareRuimte');
  const huisnummer = leesStr(bron, 'huisnummer');
  const huisletter = leesStr(bron, 'huisletter');
  const toevoeging = leesStr(bron, 'huisnummertoevoeging', 'toevoeging');
  const postbus = leesStr(bron, 'postbus');
  const postcode = leesStr(bron, 'postcode');
  const plaats = leesStr(bron, 'plaats', 'woonplaats', 'stad');

  const regels: string[] = [];
  if (straat) {
    const num = [huisnummer, huisletter].filter(Boolean).join('');
    const tail = [num, toevoeging].filter(Boolean).join('-');
    regels.push([straat, tail].filter(Boolean).join(' ').trim());
  }
  if (postbus) regels.push(`Postbus ${postbus}`);
  return { regels: regels.filter(Boolean), postcode, plaats };
}

function leesRegisterVerwijzing(obj: Record<string, unknown>): string | null {
  const direct = leesStr(obj, 'gebaseerdOp', 'registerverwijzing', 'bron');
  if (direct) return direct;
  const reg = asObj(obj.register) ?? asObj((obj as Record<string, unknown>).registerHyp4)
    ?? asObj((obj as Record<string, unknown>).hypotheekRegister);
  if (reg) {
    const naam = leesStr(reg, 'naam', 'register') ?? 'Register Hyp4';
    const deel = leesStr(reg, 'deel');
    const nummer = leesStr(reg, 'nummer');
    const parts = [naam];
    if (deel) parts.push(`Deel ${deel}`);
    if (nummer) parts.push(`nummer ${nummer}`);
    return parts.length > 1 ? `Gebaseerd op ${parts.join(' ')}` : null;
  }
  const deel = leesStr(obj, 'deel');
  const nummer = leesStr(obj, 'nummer');
  if (deel && nummer) return `Gebaseerd op Register Hyp4 Deel ${deel} nummer ${nummer}`;
  return null;
}

function leesKadastraleAanduiding(obj: Record<string, unknown>): string | null {
  const direct = leesStr(obj, 'kadastraleAanduiding', 'aanduiding',
    'kadastraalObject', 'kadastraleObjectIdentificatie');
  if (direct) return direct;
  const k = asObj(obj.kadastraalObject) ?? asObj((obj as Record<string, unknown>).object);
  if (k) {
    const g = leesStr(k, 'gemeente', 'kadastraleGemeente');
    const s = leesStr(k, 'sectie');
    const p = leesStr(k, 'perceelnummer', 'perceel');
    const i = leesStr(k, 'appartementsindex', 'index');
    const samen = [g, s, p].filter(Boolean).join(' ');
    return [samen, i ? `A${i}` : null].filter(Boolean).join(' ').trim() || null;
  }
  return null;
}

function mapRechthebbende(
  raw: unknown,
  context?: { rechtstype?: string | null; aandeel?: string | null },
): KadasterRechtenBlok | null {
  const rr = asObj(raw); if (!rr) return null;

  const persoon = asObj(rr.persoon) ?? asObj(rr.natuurlijkPersoon)
    ?? asObj((rr as Record<string, unknown>).naturalPerson)
    ?? asObj((rr as Record<string, unknown>).naamNatuurlijkPersoon);
  const ond = asObj(rr.onderneming) ?? asObj(rr.nietNatuurlijkPersoon)
    ?? asObj(rr.rechtspersoon) ?? asObj((rr as Record<string, unknown>).organisatie)
    ?? asObj((rr as Record<string, unknown>).legalEntity)
    ?? asObj((rr as Record<string, unknown>).naamNietNatuurlijkPersoon);

  const naam = leesStr(persoon, 'volledigeNaam', 'naam', 'achternaam', 'geslachtsnaam')
    ?? leesStr(rr, 'naam', 'volledigeNaam', 'achternaam', 'naamRechthebbende', 'gerechtigde', 'rechthebbende');
  const bedrijfsnaam = leesStr(ond, 'statutaireNaam', 'naam', 'handelsnaam', 'organisatieNaam')
    ?? leesStr(rr, 'bedrijfsnaam', 'statutaireNaam', 'handelsnaam', 'organisatieNaam');

  const rechtstype = context?.rechtstype ?? leesRechtstype(rr);
  const aandeel = context?.aandeel
    ?? leesAandeel(rr.aandeel)
    ?? leesAandeel((rr as Record<string, unknown>).aandeelInRecht)
    ?? leesAandeel((rr as Record<string, unknown>).breukdeel)
    ?? leesAandeel((rr as Record<string, unknown>).gerechtigdAandeel)
    ?? leesAandeel((rr as Record<string, unknown>).share);

  if (!naam && !bedrijfsnaam && !rechtstype && !aandeel) return null;

  const persoonType: KadasterRechtenBlok['persoonType'] = persoon
    ? 'natuurlijk'
    : (ond || bedrijfsnaam) ? 'rechtspersoon' : null;

  const geboortedatum = leesStr(persoon, 'geboortedatum', 'geboren', 'dateOfBirth')
    ?? leesStr(rr, 'geboortedatum', 'geboren', 'dateOfBirth');
  const geboorteplaats = leesStr(persoon, 'geboorteplaats', 'placeOfBirth')
    ?? leesStr(rr, 'geboorteplaats', 'placeOfBirth');
  const zetel = leesStr(ond, 'zetel', 'statutaireZetel', 'vestigingsplaats')
    ?? leesStr(rr, 'zetel', 'statutaireZetel', 'vestigingsplaats');
  const kvkNummer = leesStr(ond, 'kvkNummer', 'kvk', 'kamerVanKoophandel', 'kvkNumber')
    ?? leesStr(rr, 'kvkNummer', 'kvk', 'kamerVanKoophandel', 'kvkNumber');

  const { regels, postcode, plaats } = leesAdresRegels(rr);
  const registerVerwijzing = leesRegisterVerwijzing(rr);
  const kadastraleAanduiding = leesKadastraleAanduiding(rr);

  return {
    id: `${naam ?? bedrijfsnaam ?? 'rechthebbende'}-${rechtstype ?? ''}-${aandeel ?? ''}-${Math.random().toString(36).slice(2, 8)}`,
    rechtstype, aandeel, naam, bedrijfsnaam, persoonType,
    geboortedatum, geboorteplaats,
    adresRegels: regels, postcode, plaats,
    zetel, kvkNummer, registerVerwijzing, kadastraleAanduiding,
    bron: 'json',
  };
}

const RECHT_CONTAINER_KEYS = [
  'rechten', 'overigeRechten', 'zakelijkeRechten', 'rechtenLijst',
  'eigendom', 'eigendommen', 'beperkteRechten',
];
const RECHTHEBBENDE_LIJST_KEYS = [
  'rechthebbenden', 'tenaamstellingen', 'gerechtigden', 'eigenaren',
  'rightHolders', 'personen', 'rechtspersonen', 'natuurlijkePersonen',
  'nietNatuurlijkePersonen', 'betrokkenen', 'aantekeningen',
  // Kadaster Objectinformatie API gebruikt 'persons' / 'entities'
  // binnen elk rechten-item voor natuurlijke personen en rechtspersonen.
  'persons', 'entities',
];

/**
 * Hoofdfunctie: probeer eerst per-recht-blokken te vinden (Eigendom met
 * 2 rechthebbenden → 2 blokken), val terug op platte rechthebbenden-lijsten.
 */
export function mapRechtenBlokken(raw: unknown): KadasterRechtenBlok[] {
  const data = asObj(raw); if (!data) return [];
  const blokken: KadasterRechtenBlok[] = [];

  // 1) Per-rechttype containers (rechten met genest rechthebbenden-array).
  for (const key of RECHT_CONTAINER_KEYS) {
    const v = data[key];
    const items = Array.isArray(v) ? v : (asObj(v) ? [v] : []);
    for (const item of items) {
      const obj = asObj(item); if (!obj) continue;
      const rechtstype = leesRechtstype(obj)
        ?? normaliseerRechtstype(key);
      const aandeel = leesAandeel(obj.aandeel)
        ?? leesAandeel((obj as Record<string, unknown>).aandeelInRecht)
        ?? leesAandeel((obj as Record<string, unknown>).breukdeel)
        ?? leesAandeel((obj as Record<string, unknown>).gerechtigdAandeel);

      let geneste: unknown[] | null = null;
      for (const lk of RECHTHEBBENDE_LIJST_KEYS) {
        const l = (obj as Record<string, unknown>)[lk];
        if (Array.isArray(l) && l.length > 0) { geneste = l; break; }
      }
      if (geneste) {
        for (const rh of geneste) {
          const b = mapRechthebbende(rh, { rechtstype, aandeel });
          if (b) blokken.push(b);
        }
      } else {
        const b = mapRechthebbende(obj, { rechtstype, aandeel });
        if (b) blokken.push(b);
      }
    }
  }

  // 2) Platte top-level rechthebbenden-arrays — alleen als nog geen blokken.
  if (blokken.length === 0) {
    for (const lk of RECHTHEBBENDE_LIJST_KEYS) {
      const l = data[lk];
      if (!Array.isArray(l) || l.length === 0) continue;
      for (const rh of l) {
        const b = mapRechthebbende(rh);
        if (b) blokken.push(b);
      }
      if (blokken.length > 0) break;
    }
  }

  return blokken;
}

/**
 * Bouw een minimaal blok uit een opgeslagen kadaster_data_record (rechten).
 * Wordt gebruikt wanneer raw_limited.rechten.blokken niet beschikbaar is.
 */
export function blokUitOpgeslagenRecord(r: {
  rechthebbende_naam: string | null;
  rechthebbende_type: string | null;
  rechtsoort: string | null;
  aandeel: string | null;
  kadastrale_aanduiding: string | null;
}): KadasterRechtenBlok | null {
  if (!r.rechthebbende_naam && !r.rechtsoort && !r.aandeel) return null;
  const isRp = (r.rechthebbende_type ?? '').toLowerCase().includes('recht');
  return {
    id: 'opgeslagen',
    rechtstype: normaliseerRechtstype(r.rechtsoort),
    aandeel: r.aandeel,
    naam: isRp ? null : r.rechthebbende_naam,
    bedrijfsnaam: isRp ? r.rechthebbende_naam : null,
    persoonType: isRp ? 'rechtspersoon' : (r.rechthebbende_naam ? 'natuurlijk' : null),
    geboortedatum: null, geboorteplaats: null,
    adresRegels: [], postcode: null, plaats: null,
    zetel: null, kvkNummer: null, registerVerwijzing: null,
    kadastraleAanduiding: r.kadastrale_aanduiding,
    bron: 'json',
  };
}
