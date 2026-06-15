// Helpers voor de "Brief voorbereiden"-flow op een Off-Market signaal.
//
// V1.1 — voegt toe:
//  - extractie van rechthebbende-adres uit opgeslagen Kadasterrecords
//    (raw_limited.rechten.blokken[*].persons|entities[*].adres etc.)
//  - apart veld "objectomschrijving in brief" (kan breder zijn dan het
//    technische objectadres, bv. "Prinsengracht 340-A en 340-B te Amsterdam")
//  - placeholderveiligheid: zichtbare placeholdertekst mag nooit als echte
//    waarde worden opgeslagen / gekopieerd / geprint
//
// Bewust geen DOCX-export, AI-generatie, KVK-verrijking of automatisch
// versturen.

import { schoonAdresTekst } from '@/lib/offMarket/onderzoeksAdres';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import { mapRechtenBlokken } from '@/lib/kadaster/rechtenBlokken';

export const BITO_CONTACT = {
  naam: 'Ramysh Bito',
  functie: 'Eigenaar & Vastgoedadviseur',
  bedrijf: 'Bito Vastgoed',
  telefoon: '+31 6 16 98 76 06',
  email: 'info@bitovastgoed.nl',
  website: 'www.bitovastgoed.nl',
} as const;

/** Zichtbare placeholdertekst voor het verzendadres-veld. */
export const VERZENDADRES_PLACEHOLDER = 'Straat 1\n1234 AB Plaats';

export interface EigenaarKandidaat {
  /** Volledige naam zoals getoond in dropdown. */
  label: string;
  naam: string | null;
  bedrijfsnaam: string | null;
  /** Aanbevolen verzendadres indien bekend. Multiline. */
  verzendadres: string | null;
  bron: 'signaal' | 'kadaster' | 'brief';
  recordId?: string | null;
  fetchedAt?: string | null;
  debugBron?: string | null;
}

export interface KadasterAdresDebugInfo {
  gevonden: boolean;
  bronLabel: string | null;
  parsedLabel: string | null;
  aantalKandidaten: number;
}

export interface HistorischBriefAdres {
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

// ---------------------------------------------------------------------
// Objectadres / objectomschrijving
// ---------------------------------------------------------------------

/**
 * Bouw het volledige technische objectadres. Schoont signaalwoorden
 * zoals "Aanvraag", "Vergunning", "Besluit" uit en behoudt huisletter,
 * toevoeging en postcode.
 */
export function bouwObjectAdresVoorBrief(
  signaal: Pick<OffMarketSignaal, 'adres' | 'postcode' | 'plaats' | 'titel'>,
): string {
  const adres = schoonAdresTekst(signaal.adres ?? '') || schoonAdresTekst(signaal.titel ?? '');
  const postcode = (signaal.postcode ?? '').trim();
  const plaats = (signaal.plaats ?? '').trim();
  const tweede = [postcode, plaats].filter(Boolean).join(' ').trim();
  return [adres, tweede].filter(Boolean).join(', ').trim();
}

/**
 * Bouw een voorstel voor "Objectomschrijving in brief". Voor V1.1 gelijk
 * aan het feitelijke objectadres met "te <plaats>"-formulering wanneer
 * het adres alleen straat+huisnummer bevat. De gebruiker kan dit handmatig
 * verbreden naar "Prinsengracht 340-A en 340-B te Amsterdam" e.d.
 */
export function bouwObjectOmschrijvingVoorstel(
  signaal: Pick<OffMarketSignaal, 'adres' | 'postcode' | 'plaats' | 'titel'>,
): string {
  const straatHuisnr = schoonAdresTekst(signaal.adres ?? '') || schoonAdresTekst(signaal.titel ?? '');
  if (!straatHuisnr) return '';
  const plaats = (signaal.plaats ?? '').trim();
  if (!plaats) return straatHuisnr;
  // Vermijd dubbele plaatsnaam.
  if (straatHuisnr.toLowerCase().includes(plaats.toLowerCase())) return straatHuisnr;
  return `${straatHuisnr} te ${plaats}`;
}

// ---------------------------------------------------------------------
// Aanhef / onderwerp / brieftekst
// ---------------------------------------------------------------------

export function getAchternaam(naam: string | null | undefined): string | null {
  if (!naam) return null;
  const schoon = naam.trim().replace(/\s+/g, ' ');
  if (!schoon) return null;
  const voorKomma = schoon.split(',')[0].trim();
  const delen = voorKomma.split(' ').filter(Boolean);
  if (delen.length === 0) return null;
  return delen[delen.length - 1];
}

export function bepaalAanhef(eigenaarNaam: string | null | undefined): string {
  const achter = getAchternaam(eigenaarNaam);
  return achter ? `Geachte heer/mevrouw ${achter},` : 'Geachte heer/mevrouw,';
}

export function bepaalOnderwerp(): string {
  return 'Vrijblijvende interesse in vastgoedbezit';
}

export interface BriefTekstInput {
  aanhef: string;
  /**
   * Wat in de zin "Ik neem contact met u op naar aanleiding van het
   * vastgoed aan …" komt te staan. Mag breder zijn dan het technische
   * objectadres. Naam blijft `objectadres` voor backwards-compat.
   */
  objectadres: string;
}

export function bouwBriefTekst({ aanhef, objectadres }: BriefTekstInput): string {
  const adresZin = objectadres
    ? `Ik neem contact met u op naar aanleiding van het vastgoed aan ${objectadres}.`
    : 'Ik neem contact met u op naar aanleiding van uw vastgoedbezit.';

  return [
    aanhef,
    '',
    `Mijn naam is ${BITO_CONTACT.naam}, eigenaar van ${BITO_CONTACT.bedrijf}. Vanuit mijn kantoor begeleid ik professionele beleggers, ontwikkelaars en vastgoedondernemers bij de aan- en verkoop van vastgoed, vaak in discrete trajecten buiten het openbare aanbod.`,
    '',
    `${adresZin} Binnen mijn netwerk is er regelmatig vraag naar vastgoed in deze omgeving, met name naar panden met beleggings-, verhuur-, splitsings-, transformatie- of ontwikkelpotentie.`,
    '',
    'Mocht u op dit moment, of wellicht op termijn, overwegen om dit pand, ander vastgoed of een bredere vastgoedportefeuille te verkopen, dan kom ik graag op een laagdrempelige manier met u in contact. Een eerste gesprek verplicht uiteraard tot niets en kan ook uitsluitend oriënterend zijn.',
    '',
    `${BITO_CONTACT.bedrijf} werkt voornamelijk met professionele marktpartijen en begeleidt vastgoedtrajecten op een zorgvuldige en discrete manier. Indien verkoop voor u niet speelt, dan kunt u deze brief uiteraard als niet verzonden beschouwen. Mocht u echter openstaan voor een eerste kennismaking of marktverkenning, dan denk ik graag met u mee over de mogelijkheden.`,
    '',
    'Ik hoor graag of er vragen zijn of interesse is.',
    '',
    'Met vriendelijke groet,',
    '',
    BITO_CONTACT.naam,
    `${BITO_CONTACT.functie}`,
    BITO_CONTACT.bedrijf,
    '',
    `T: ${BITO_CONTACT.telefoon}`,
    `E: ${BITO_CONTACT.email}`,
    `W: ${BITO_CONTACT.website}`,
  ].join('\n');
}

// ---------------------------------------------------------------------
// Kadaster → rechthebbende-adres extractie
// ---------------------------------------------------------------------

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>) : null;
}
function asStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Probeer uit één persoon/entiteit-blok een verzendadres te halen.
 * Kadaster levert het adres niet altijd in de JSON; deze functie is
 * defensief en faalt netjes terug op `null` als er niets bruikbaars
 * staat. Ondersteunde shapes:
 *  - { adres: { straat, huisnummer, huisletter, huisnummertoevoeging,
 *               postcode, plaats|woonplaats } }
 *  - { woonadres: {...} } / { vestigingsadres: {...} } / { correspondentieadres: {...} }
 *  - platte velden direct op het persoon-blok (straat, postcode, …)
 *  - { adres: "De Borcht 3\n1083AC Amsterdam" } (al voorgeformatteerd)
 */
function bouwAdresUitBlok(blok: unknown): string | null {
  const b = asObj(blok);
  if (!b) return null;

  const kandidaten = [
    b.adres, b.woonadres, b.vestigingsadres, b.correspondentieadres, b,
  ];
  for (const k of kandidaten) {
    if (typeof k === 'string' && k.trim()) {
      // Al voorgeformatteerd. Normaliseer whitespace, behoud regelovergangen.
      return k.replace(/[ \t]+/g, ' ').replace(/\r/g, '').trim();
    }
    const o = asObj(k);
    if (!o) continue;
    const straat = asStr(o.straat) ?? asStr(o.straatnaam) ?? asStr((o as Record<string, unknown>).street);
    const huisnr = asStr(o.huisnummer) ?? asStr((o as Record<string, unknown>).number);
    const huisletter = asStr(o.huisletter);
    const toevoeging = asStr(o.huisnummertoevoeging) ?? asStr(o.toevoeging);
    const postcode = asStr(o.postcode);
    const plaats = asStr(o.plaats) ?? asStr(o.woonplaats) ?? asStr((o as Record<string, unknown>).city);
    const postbus = asStr(o.postbus);

    const regel1Delen = [
      straat,
      [huisnr, huisletter].filter(Boolean).join(''),
      toevoeging ? `-${toevoeging}` : null,
    ].filter(Boolean);
    let regel1 = '';
    if (regel1Delen.length > 0) {
      // Plak huisletter aan huisnummer (160-H -> "160H"? Nee, Kadaster gebruikt
      // vaak "160H"; wij volgen woordvolgorde: "Straat huisnr[letter][-toev]")
      regel1 = `${straat ?? ''} ${huisnr ?? ''}${huisletter ?? ''}${toevoeging ? `-${toevoeging}` : ''}`.trim();
    } else if (postbus) {
      regel1 = `Postbus ${postbus}`;
    }
    const regel2 = [postcode, plaats].filter(Boolean).join(' ').trim();
    if (regel1 || regel2) {
      return [regel1, regel2].filter(Boolean).join('\n');
    }
  }
  return null;
}

/**
 * Loop door alle rechten-blokken in een Kadasterrecord en extraheer
 * naam + verzendadres van de eerste rechthebbende. Geeft `null` terug
 * als niets bruikbaars is.
 */
export interface RechthebbendeUitKadaster {
  naam: string | null;
  bedrijfsnaam: string | null;
  verzendadres: string | null;
}

export function extraheerRechthebbendenUitRecord(
  record: KadasterDataRecord,
): RechthebbendeUitKadaster[] {
  const raw = (record.raw_limited as Record<string, unknown> | null) ?? {};
  const verzameld: RechthebbendeUitKadaster[] = [];

  // 1) Primair: gedeelde Kadaster-rechtenparser. Vangt naamNatuurlijkPersoon,
  //    naamNietNatuurlijkPersoon, persons/entities, tenaamstellingen etc.
  const bronnen: unknown[] = [raw];
  const rechtenSub = asObj((raw as Record<string, unknown>).rechten);
  if (rechtenSub) bronnen.push(rechtenSub);
  for (const bron of bronnen) {
    for (const b of mapRechtenBlokken(bron)) {
      const naam = b.naam ?? null;
      const bedrijfsnaam = b.bedrijfsnaam ?? null;
      const adresRegel1 = b.adresRegels[0] ?? null;
      const adresRegel2 = [b.postcode, b.plaats].filter(Boolean).join(' ').trim();
      const verzendadres = [adresRegel1, adresRegel2 || null].filter(Boolean).join('\n').trim() || null;
      if (!naam && !bedrijfsnaam && !verzendadres) continue;
      verzameld.push({ naam, bedrijfsnaam, verzendadres });
    }
  }

  // 2) Secundair: legacy/extra `raw_limited.rechten.blokken[*].persons` shape.
  //    Vult vaak een fuller naam (voornamen + achternaam) of een
  //    voorgeformatteerd string-adres aan dat de generieke parser laat liggen.
  const rechten = asObj((raw as Record<string, unknown>).rechten) ?? {};
  const legacyBlokken = Array.isArray(rechten.blokken) ? (rechten.blokken as unknown[]) : [];
  for (const blok of legacyBlokken) {
    const b = asObj(blok); if (!b) continue;
    const lijsten: unknown[] = [];
    for (const k of ['persons', 'entities', 'rechthebbenden', 'personen']) {
      const v = (b as Record<string, unknown>)[k];
      if (Array.isArray(v)) lijsten.push(...v);
    }
    for (const p of lijsten) {
      const po = asObj(p); if (!po) continue;
      const voornamen = asStr(po.voornamen);
      const achternaam = asStr(po.naam) ?? asStr((po as Record<string, unknown>).geslachtsnaam)
        ?? asStr((po as Record<string, unknown>).achternaam);
      const samengesteld = [voornamen, achternaam].filter(Boolean).join(' ').trim();
      const volledig = asStr(po.volledigeNaam) ?? (samengesteld || null);
      const bedrijfsnaam = asStr(po.statutaireNaam) ?? asStr(po.handelsnaam)
        ?? asStr((po as Record<string, unknown>).organisatieNaam)
        ?? asStr((po as Record<string, unknown>).bedrijfsnaam);
      const adres = bouwAdresUitBlok(po);
      if (!volledig && !bedrijfsnaam && !adres) continue;
      verzameld.push({ naam: volledig, bedrijfsnaam: bedrijfsnaam ?? null, verzendadres: adres });
    }
  }

  // Merge: dedup op (achternaam-token | bedrijfsnaam), kies rijkste naam +
  //        bewaar elk gevonden verzendadres.
  const merged = new Map<string, RechthebbendeUitKadaster>();
  for (const rh of verzameld) {
    const naamLast = (rh.naam ?? '').trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    const key = `${naamLast}|${(rh.bedrijfsnaam ?? '').toLowerCase()}`;
    if (!key.replace('|', '')) continue;
    const bestaand = merged.get(key);
    if (!bestaand) { merged.set(key, { ...rh }); continue; }
    // Kies rijkste naam (meer woorden) en eerste niet-lege adres.
    const woordenNieuw = (rh.naam ?? '').trim().split(/\s+/).filter(Boolean).length;
    const woordenOud = (bestaand.naam ?? '').trim().split(/\s+/).filter(Boolean).length;
    if (woordenNieuw > woordenOud) bestaand.naam = rh.naam;
    if (!bestaand.bedrijfsnaam && rh.bedrijfsnaam) bestaand.bedrijfsnaam = rh.bedrijfsnaam;
    if (!bestaand.verzendadres && rh.verzendadres) bestaand.verzendadres = rh.verzendadres;
  }
  const out = Array.from(merged.values());

  // 3) Allerlaatste fallback: top-level rechthebbende_naam zonder adres.
  if (out.length === 0 && record.rechthebbende_naam) {
    out.push({
      naam: record.rechthebbende_naam,
      bedrijfsnaam: null,
      verzendadres: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// Kandidaten + prefill
// ---------------------------------------------------------------------

export function extraheerEigenaarKandidaten(
  signaal: OffMarketSignaal,
  kadasterRecords: KadasterDataRecord[] = [],
): EigenaarKandidaat[] {
  const a = signaal as any;
  const lijst: EigenaarKandidaat[] = [];

  const naam = (a.eigenaar_naam ?? '').trim();
  const bedrijf = (a.eigenaar_bedrijfsnaam ?? '').trim();
  const eigenaarAdres: string | null = (a.eigenaar_verzendadres ?? a.eigenaar_adres ?? null);

  if (naam) {
    lijst.push({
      label: bedrijf && bedrijf !== naam ? `${naam} — ${bedrijf}` : naam,
      naam,
      bedrijfsnaam: bedrijf || null,
      verzendadres: eigenaarAdres ?? null,
      bron: 'signaal',
    });
  } else if (bedrijf) {
    lijst.push({
      label: bedrijf,
      naam: null,
      bedrijfsnaam: bedrijf,
      verzendadres: eigenaarAdres ?? null,
      bron: 'signaal',
    });
  }

  for (const r of kadasterRecords) {
    const rechten = extraheerRechthebbendenUitRecord(r);
    for (const rh of rechten) {
      const naamMatch = (rh.naam ?? rh.bedrijfsnaam ?? '').toLowerCase();
      if (!naamMatch) continue;
      const al = lijst.some(k =>
        (k.naam ?? '').toLowerCase() === naamMatch
        || (k.bedrijfsnaam ?? '').toLowerCase() === naamMatch,
      );
      if (al) {
        // Verrijk bestaande kandidaat met Kadaster-verzendadres indien
        // wij nu wel een adres hebben en eerder nog niet.
        const bestaand = lijst.find(k =>
          (k.naam ?? '').toLowerCase() === naamMatch
          || (k.bedrijfsnaam ?? '').toLowerCase() === naamMatch,
        );
        if (bestaand && !bestaand.verzendadres && rh.verzendadres) {
          bestaand.verzendadres = rh.verzendadres;
        }
        continue;
      }
      const label = rh.naam ?? rh.bedrijfsnaam ?? '—';
      lijst.push({
        label,
        naam: rh.naam,
        bedrijfsnaam: rh.bedrijfsnaam,
        verzendadres: rh.verzendadres,
        bron: 'kadaster',
      });
    }
  }

  return lijst;
}

export interface BriefPrefill {
  eigenaarNaam: string;
  eigenaarBedrijfsnaam: string;
  verzendadres: string;
  /** Feitelijk objectadres (technisch, niet weglaten van toevoeging). */
  objectadres: string;
  /** Editable omschrijving zoals deze in de brieftekst terechtkomt. */
  objectomschrijving: string;
  aanhef: string;
  onderwerp: string;
  brieftekst: string;
  kandidaten: EigenaarKandidaat[];
}

export function bouwBriefPrefill(
  signaal: OffMarketSignaal,
  kadasterRecords: KadasterDataRecord[] = [],
): BriefPrefill {
  const kandidaten = extraheerEigenaarKandidaten(signaal, kadasterRecords);
  // Kies kandidaat met verzendadres als eerste indien beschikbaar,
  // anders de eerste in volgorde.
  const metAdres = kandidaten.find(k => !!k.verzendadres);
  const eerste = metAdres ?? kandidaten[0] ?? null;

  const eigenaarNaam = eerste?.naam ?? '';
  const eigenaarBedrijfsnaam = eerste?.bedrijfsnaam ?? '';
  const verzendadres = eerste?.verzendadres ?? '';
  const objectadres = bouwObjectAdresVoorBrief(signaal);
  const objectomschrijving = bouwObjectOmschrijvingVoorstel(signaal) || objectadres;
  const aanhef = bepaalAanhef(eigenaarNaam || null);
  const onderwerp = bepaalOnderwerp();
  const brieftekst = bouwBriefTekst({ aanhef, objectadres: objectomschrijving });
  return {
    eigenaarNaam, eigenaarBedrijfsnaam, verzendadres,
    objectadres, objectomschrijving,
    aanhef, onderwerp, brieftekst,
    kandidaten,
  };
}

export function kanBriefVoorbereiden(
  signaal: OffMarketSignaal,
  kadasterRecords: KadasterDataRecord[] = [],
): { ok: boolean; reden: string | null } {
  const objectadres = bouwObjectAdresVoorBrief(signaal);
  if (!objectadres) {
    return { ok: false, reden: 'Vul eerst eigenaar/rechthebbende en objectadres aan.' };
  }
  const kandidaten = extraheerEigenaarKandidaten(signaal, kadasterRecords);
  if (kandidaten.length === 0) {
    return { ok: false, reden: 'Vul eerst eigenaar/rechthebbende en objectadres aan.' };
  }
  return { ok: true, reden: null };
}

export function bouwGeadresseerdeBlok(input: {
  naam: string;
  bedrijfsnaam: string;
  verzendadres: string;
}): string[] {
  const lines: string[] = [];
  if (input.bedrijfsnaam) lines.push(input.bedrijfsnaam);
  if (input.naam) lines.push(input.naam);
  if (input.verzendadres) {
    for (const r of input.verzendadres.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      lines.push(r);
    }
  }
  return lines;
}

export function formatDatumNL(d: Date = new Date()): string {
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------
// Centraal brief-viewmodel — gedeeld door modal, kopieeractie en PDF.
// Voorkomt dat de modal iets anders toont dan de PDF / kopieerbrief.
// ---------------------------------------------------------------------

const _PLACEHOLDER_NORM = VERZENDADRES_PLACEHOLDER.replace(/\s+/g, ' ').trim().toLowerCase();
function _isEcht(v: string | null | undefined): boolean {
  if (!v) return false;
  const norm = v.replace(/\s+/g, ' ').trim().toLowerCase();
  return !!norm && norm !== _PLACEHOLDER_NORM;
}

export interface BriefViewModel {
  geadresseerdeNaam: string;
  bedrijfsnaam: string;
  verzendadresRegels: string[];
  verzendadres: string;
  heeftVerzendadres: boolean;
  objectomschrijving: string;
  onderwerp: string;
  brieftekst: string;
  datum: string;
  contact: typeof BITO_CONTACT;
}

export interface BriefBronInput {
  eigenaarNaam: string;
  eigenaarBedrijfsnaam: string;
  verzendadres: string;
  objectomschrijving: string;
  onderwerp: string;
  brieftekst: string;
}

export function buildBriefViewModel(input: BriefBronInput): BriefViewModel {
  const veiligVerzend = _isEcht(input.verzendadres) ? input.verzendadres.trim() : '';
  const regels = veiligVerzend
    ? veiligVerzend.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    : [];
  return {
    geadresseerdeNaam: (input.eigenaarNaam ?? '').trim(),
    bedrijfsnaam: (input.eigenaarBedrijfsnaam ?? '').trim(),
    verzendadresRegels: regels,
    verzendadres: veiligVerzend,
    heeftVerzendadres: regels.length > 0,
    objectomschrijving: (input.objectomschrijving ?? '').trim(),
    onderwerp: (input.onderwerp ?? '').trim() || bepaalOnderwerp(),
    brieftekst: input.brieftekst ?? '',
    datum: formatDatumNL(),
    contact: BITO_CONTACT,
  };
}

/** Brief als platte tekst (voor kopieeractie). */
export function briefAlsPlatteTekst(vm: BriefViewModel): string {
  const lines: string[] = [];
  if (vm.bedrijfsnaam) lines.push(vm.bedrijfsnaam);
  if (vm.geadresseerdeNaam) lines.push(vm.geadresseerdeNaam);
  for (const r of vm.verzendadresRegels) lines.push(r);
  lines.push('');
  lines.push(vm.datum);
  lines.push('');
  lines.push(`Betreft: ${vm.onderwerp}`);
  lines.push('');
  lines.push(vm.brieftekst);
  return lines.join('\n');
}

