// Helpers voor de "Brief voorbereiden"-flow op een Off-Market signaal.
//
// Bevat:
// - vaste Bito Vastgoed-contactgegevens (BITO_CONTACT)
// - extractie van eigenaar-/rechthebbendekandidaten uit het signaal en
//   uit opgeslagen Kadasterrecords
// - opbouw van objectadres (zonder signaalwoorden zoals "Aanvraag",
//   "Vergunning", "Besluit")
// - opbouw van aanhef en standaard brieftekst
//
// Bewust geen DOCX-export, AI-generatie of automatisch versturen.
//
// De BITO_CONTACT-constante is met opzet één centrale plek zodat deze
// later eenvoudig naar een bedrijfsinstellingenmodule of gebruikersprofiel
// kan worden verplaatst, zonder de UI te raken.

import { schoonAdresTekst } from '@/lib/offMarket/onderzoeksAdres';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';

export const BITO_CONTACT = {
  naam: 'Ramysh Bito',
  functie: 'Eigenaar & Vastgoedadviseur',
  bedrijf: 'Bito Vastgoed',
  telefoon: '+31 6 16 98 76 06',
  email: 'info@bitovastgoed.nl',
  website: 'www.bitovastgoed.nl',
} as const;

export interface EigenaarKandidaat {
  /** Volledige naam zoals getoond in dropdown. */
  label: string;
  naam: string | null;
  bedrijfsnaam: string | null;
  /** Aanbevolen verzendadres indien bekend. */
  verzendadres: string | null;
  bron: 'signaal' | 'kadaster';
}

/**
 * Bouw het volledige objectadres voor een brief. Schoont signaalwoorden
 * zoals "Aanvraag", "Vergunning", "Besluit" uit en behoudt huisletter,
 * toevoeging en postcode.
 *
 * Voorbeelden:
 * - "Marco Polostraat 251-H, Amsterdam"
 * - "Nieuwe Binnenweg 256A-01, 3021 GP Rotterdam"
 */
export function bouwObjectAdresVoorBrief(signaal: Pick<OffMarketSignaal, 'adres' | 'postcode' | 'plaats' | 'titel'>): string {
  const adres = schoonAdresTekst(signaal.adres ?? '') || schoonAdresTekst(signaal.titel ?? '');
  const postcode = (signaal.postcode ?? '').trim();
  const plaats = (signaal.plaats ?? '').trim();
  const tweede = [postcode, plaats].filter(Boolean).join(' ').trim();
  return [adres, tweede].filter(Boolean).join(', ').trim();
}

/**
 * Haal de achternaam uit een volledige naam. Negeert tussenvoegsels.
 * Wordt gebruikt voor "Geachte heer/mevrouw [achternaam],".
 */
export function getAchternaam(naam: string | null | undefined): string | null {
  if (!naam) return null;
  const schoon = naam.trim().replace(/\s+/g, ' ');
  if (!schoon) return null;
  // Strip suffix achter komma (bv. "Jansen, P.")
  const voorKomma = schoon.split(',')[0].trim();
  const delen = voorKomma.split(' ').filter(Boolean);
  if (delen.length === 0) return null;
  // Achternaam = laatste woord. Eenvoudig, voorspelbaar.
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
  objectadres: string;
}

/**
 * Standaard brieftekst. Bewust geen vermelding van Kadaster, Radar,
 * scraping of andere interne bronnen. Toon: professioneel, rustig,
 * vrijblijvend, zowel particulier als zakelijk bruikbaar.
 */
export function bouwBriefTekst({ aanhef, objectadres }: BriefTekstInput): string {
  const adresZin = objectadres
    ? `Ik neem contact met u op naar aanleiding van het pand aan ${objectadres}.`
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

/**
 * Verzamel mogelijke eigenaren/rechthebbenden uit het signaal en uit
 * eventueel geleverde Kadasterrecords. Volgorde:
 *  1. eigenaar_naam (signaal)
 *  2. eigenaar_bedrijfsnaam (signaal)
 *  3. rechthebbende_naam (Kadasterrecords, meest recent eerst)
 * Dubbele namen worden gefilterd.
 */
export function extraheerEigenaarKandidaten(
  signaal: OffMarketSignaal,
  kadasterRecords: KadasterDataRecord[] = [],
): EigenaarKandidaat[] {
  const a = signaal as any;
  const lijst: EigenaarKandidaat[] = [];

  const naam = (a.eigenaar_naam ?? '').trim();
  const bedrijf = (a.eigenaar_bedrijfsnaam ?? '').trim();
  if (naam) {
    lijst.push({
      label: bedrijf && bedrijf !== naam ? `${naam} — ${bedrijf}` : naam,
      naam,
      bedrijfsnaam: bedrijf || null,
      verzendadres: null,
      bron: 'signaal',
    });
  } else if (bedrijf) {
    lijst.push({
      label: bedrijf,
      naam: null,
      bedrijfsnaam: bedrijf,
      verzendadres: null,
      bron: 'signaal',
    });
  }

  for (const r of kadasterRecords) {
    const rNaam = (r.rechthebbende_naam ?? '').trim();
    if (!rNaam) continue;
    const al = lijst.some(k => (k.naam ?? '').toLowerCase() === rNaam.toLowerCase()
      || (k.bedrijfsnaam ?? '').toLowerCase() === rNaam.toLowerCase());
    if (al) continue;
    const type = (r.rechthebbende_type ?? '').toUpperCase();
    // "NATUURLIJK_PERSOON" = particulier; alle andere typen (incl.
    // "NIET_NATUURLIJK_PERSOON", "RECHTSPERSOON") behandelen we als bedrijf.
    const isParticulier = type.includes('NATUURLIJK_PERSOON') && !type.includes('NIET_NATUURLIJK_PERSOON');
    const isBedrijf = !!type && !isParticulier;
    lijst.push({
      label: rNaam,
      naam: isBedrijf ? null : rNaam,
      bedrijfsnaam: isBedrijf ? rNaam : null,
      verzendadres: null,
      bron: 'kadaster',
    });
  }

  return lijst;
}

export interface BriefPrefill {
  eigenaarNaam: string;
  eigenaarBedrijfsnaam: string;
  verzendadres: string;
  objectadres: string;
  aanhef: string;
  onderwerp: string;
  brieftekst: string;
  /** Beschikbare kandidaten voor de eigenaar/geadresseerde-keuze. */
  kandidaten: EigenaarKandidaat[];
}

export function bouwBriefPrefill(
  signaal: OffMarketSignaal,
  kadasterRecords: KadasterDataRecord[] = [],
): BriefPrefill {
  const kandidaten = extraheerEigenaarKandidaten(signaal, kadasterRecords);
  const eerste = kandidaten[0] ?? null;
  const eigenaarNaam = eerste?.naam ?? '';
  const eigenaarBedrijfsnaam = eerste?.bedrijfsnaam ?? '';
  const objectadres = bouwObjectAdresVoorBrief(signaal);
  const aanhef = bepaalAanhef(eigenaarNaam || null);
  const onderwerp = bepaalOnderwerp();
  const brieftekst = bouwBriefTekst({ aanhef, objectadres });
  return {
    eigenaarNaam,
    eigenaarBedrijfsnaam,
    verzendadres: eerste?.verzendadres ?? '',
    objectadres,
    aanhef,
    onderwerp,
    brieftekst,
    kandidaten,
  };
}

/**
 * Kan een brief voorbereid worden?
 * Vereist: minimaal een objectadres EN een eigenaar/rechthebbende
 * (eigenaar_naam, eigenaar_bedrijfsnaam, of rechthebbende uit Kadaster).
 */
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

/** Volledig adresblok voor in de print/PDF-weergave. */
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
