import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import type {
  OffMarketEigenaarbron,
  OffMarketEigenaarstatus,
  OffMarketEigenaartype,
} from '@/lib/offMarket/types';

export type KadasterRechtssituatie =
  | 'volle_eigendom'
  | 'erfpacht'
  | 'opstal'
  | 'appartementsrecht'
  | 'meerdere_rechten'
  | 'onbekend';

export interface KadasterEigenaarVoorstel {
  status: 'geen' | 'eenduidig' | 'ambigu';
  controleNodig: boolean;
  controleReden?: string;
  eigenaarstatus?: OffMarketEigenaarstatus;
  eigenaar_type?: OffMarketEigenaartype;
  eigenaar_naam?: string;
  eigenaar_bedrijfsnaam?: string;
  eigenaar_kvk?: string;
  eigenaar_straat_huisnummer?: string;
  eigenaar_postcode?: string;
  eigenaar_plaats?: string;
  eigenaar_verzendadres?: string;
  eigenaar_rechtstype?: string;
  eigenaar_aandeel?: string;
  eigenaar_rechtssituatie?: KadasterRechtssituatie;
  bloot_eigenaar?: {
    naam?: string;
    bedrijfsnaam?: string;
    kvk?: string;
    aandeel?: string;
  } | null;
  kadastrale_aanduiding?: string;
  eigenaarbron?: OffMarketEigenaarbron;
}

export interface EigenaarVoorstelForm {
  eigenaarstatus: OffMarketEigenaarstatus;
  eigenaar_naam: string;
  eigenaar_type: OffMarketEigenaartype | '';
  eigenaar_bedrijfsnaam: string;
  eigenaar_kvk: string;
  eigenaar_straat_huisnummer?: string;
  eigenaar_postcode?: string;
  eigenaar_plaats?: string;
  eigenaar_verzendadres?: string;
  eigenaar_rechtstype?: string;
  eigenaar_aandeel?: string;
  eigenaar_rechtssituatie?: KadasterRechtssituatie | '';
  bloot_eigenaar?: Record<string, unknown> | null;
  kadastrale_aanduiding: string;
  eigenaarbron: OffMarketEigenaarbron | '';
}

const schoon = (waarde: string | null | undefined): string => (waarde ?? '').trim();

function normaliseerNaam(waarde: string): string {
  return waarde.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function herkenRechtspersoonType(naam: string): OffMarketEigenaartype {
  const n = naam.toLowerCase();
  if (/(^|[^a-z])b\.?\s*v\.?($|[^a-z])|besloten vennootschap/i.test(n)) return 'bv';
  if (/\bstichting\b/i.test(n)) return 'stichting';
  if (/(^|[^a-z])v\.?\s*v\.?\s*e\.?($|[^a-z])|vereniging van (?:eigenaars|eigenaren)/i.test(n)) return 'vve';
  if (/\b(gemeente|provincie|rijksoverheid|staat der nederlanden|ministerie|waterschap)\b/i.test(n)) return 'overheid';
  return 'onbekend';
}

function soortVanRecht(rechtstype: string | null | undefined): KadasterRechtssituatie {
  const r = schoon(rechtstype).toLowerCase();
  if (!r) return 'onbekend';
  if (r.includes('erfpacht')) return 'erfpacht';
  if (r.includes('opstal')) return 'opstal';
  if (r.includes('appartementsrecht')) return 'appartementsrecht';
  if (r.includes('eigendom')) return 'volle_eigendom';
  return 'onbekend';
}

function prioriteitVoorRecht(rechtstype: string | null | undefined): number {
  switch (soortVanRecht(rechtstype)) {
    case 'erfpacht': return 50;
    case 'opstal': return 45;
    case 'appartementsrecht': return 40;
    case 'volle_eigendom': return 30;
    default: return 10;
  }
}

function labelVoorBlok(blok: KadasterRechtenBlok): string {
  const naam = schoon(blok.naam);
  const bedrijfsnaam = schoon(blok.bedrijfsnaam);
  return blok.persoonType === 'natuurlijk' ? naam : (bedrijfsnaam || naam);
}

function verzendadresVoorBlok(blok: KadasterRechtenBlok): string | undefined {
  const straat = schoon(blok.adresRegels?.[0]);
  const postcode = schoon(blok.postcode);
  const plaats = schoon(blok.plaats);
  const regels = [straat, [postcode, plaats].filter(Boolean).join(' ')].filter(Boolean);
  return regels.length > 0 ? regels.join('\n') : undefined;
}

function isVolledigAdres(blok: KadasterRechtenBlok): boolean {
  return !!schoon(blok.adresRegels?.[0]) && !!schoon(blok.postcode) && !!schoon(blok.plaats);
}

function secundaireBlootEigenaar(
  blokken: readonly KadasterRechtenBlok[],
  primaireSoort: KadasterRechtssituatie,
): KadasterEigenaarVoorstel['bloot_eigenaar'] {
  if (primaireSoort !== 'erfpacht' && primaireSoort !== 'opstal') return null;
  const eigendom = blokken.filter((b) => soortVanRecht(b.rechtstype) === 'volle_eigendom' && !!labelVoorBlok(b));
  if (eigendom.length !== 1) return null;
  const b = eigendom[0];
  return {
    naam: schoon(b.naam) || undefined,
    bedrijfsnaam: schoon(b.bedrijfsnaam) || undefined,
    kvk: schoon(b.kvkNummer) || undefined,
    aandeel: schoon(b.aandeel) || undefined,
  };
}

/**
 * Bouw een acquisitievoorstel uit reeds genormaliseerde Kadasterrechten.
 *
 * Belangrijk: bij erfpacht/opstal wordt niet de bloot eigenaar als primaire
 * acquisitiegeadresseerde gekozen, maar de rechthebbende op het beperkte
 * recht. De bloot eigenaar blijft als secundaire broninformatie behouden.
 * Meerdere verschillende rechthebbenden binnen het primaire recht zijn een
 * expliciete exception en moeten naar "Eigenaar controleren".
 */
export function maakKadasterEigenaarVoorstel(
  blokken: readonly KadasterRechtenBlok[],
): KadasterEigenaarVoorstel {
  const kandidaten = blokken
    .map((blok) => {
      const label = labelVoorBlok(blok);
      if (!label) return null;
      return {
        blok,
        label,
        sleutel: normaliseerNaam(label),
        prioriteit: prioriteitVoorRecht(blok.rechtstype),
        soort: soortVanRecht(blok.rechtstype),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (kandidaten.length === 0) {
    return { status: 'geen', controleNodig: true, controleReden: 'Geen rechthebbende uit Kadastergegevens af te leiden.' };
  }

  const hoogstePrioriteit = Math.max(...kandidaten.map((k) => k.prioriteit));
  const primair = kandidaten.filter((k) => k.prioriteit === hoogstePrioriteit);
  const uniekePrimair = new Map<string, typeof primair[number]>();
  for (const kandidaat of primair) {
    if (!uniekePrimair.has(kandidaat.sleutel)) uniekePrimair.set(kandidaat.sleutel, kandidaat);
  }

  if (uniekePrimair.size !== 1) {
    return {
      status: 'ambigu',
      controleNodig: true,
      controleReden: `Meerdere rechthebbenden binnen het primaire recht (${primair[0]?.blok.rechtstype ?? 'onbekend'}).`,
      eigenaar_rechtssituatie: primair.length > 1 ? 'meerdere_rechten' : primair[0]?.soort,
    };
  }

  const { blok, label, soort } = [...uniekePrimair.values()][0];
  const verschillendeRechtsoorten = new Set(kandidaten.map((k) => k.soort).filter((s) => s !== 'onbekend'));
  const adresCompleet = isVolledigAdres(blok);
  const controleNodig = !adresCompleet || verschillendeRechtsoorten.size > 2;
  const controleReden = !adresCompleet
    ? 'Adres van de primaire rechthebbende is niet volledig.'
    : verschillendeRechtsoorten.size > 2
      ? 'Meerdere verschillende zakelijke rechten aangetroffen.'
      : undefined;

  const basis: KadasterEigenaarVoorstel = {
    status: 'eenduidig',
    controleNodig,
    controleReden,
    eigenaarstatus: 'gevonden',
    eigenaarbron: 'kadaster',
    eigenaar_kvk: schoon(blok.kvkNummer) || undefined,
    eigenaar_straat_huisnummer: schoon(blok.adresRegels?.[0]) || undefined,
    eigenaar_postcode: schoon(blok.postcode) || undefined,
    eigenaar_plaats: schoon(blok.plaats) || undefined,
    eigenaar_verzendadres: verzendadresVoorBlok(blok),
    eigenaar_rechtstype: schoon(blok.rechtstype) || undefined,
    eigenaar_aandeel: schoon(blok.aandeel) || undefined,
    eigenaar_rechtssituatie: soort,
    bloot_eigenaar: secundaireBlootEigenaar(blokken, soort),
    kadastrale_aanduiding: schoon(blok.kadastraleAanduiding) || undefined,
  };

  if (blok.persoonType === 'natuurlijk') {
    return {
      ...basis,
      eigenaar_type: 'particulier',
      eigenaar_naam: label,
    };
  }

  return {
    ...basis,
    eigenaar_type: herkenRechtspersoonType(label),
    eigenaar_bedrijfsnaam: label,
  };
}

/**
 * Vul alleen lege velden aan. Handmatig ingevoerde waarden hebben altijd
 * voorrang. De status wordt alleen lokaal "gevonden" zodra na samenvoegen
 * werkelijk een eigenaarnaam of bedrijfsnaam aanwezig is.
 */
export function pasKadasterVoorstelToe<T extends EigenaarVoorstelForm>(
  form: T,
  voorstel: KadasterEigenaarVoorstel,
): T {
  if (voorstel.status !== 'eenduidig') return form;

  const volgende: T = {
    ...form,
    eigenaar_naam: form.eigenaar_naam || voorstel.eigenaar_naam || '',
    eigenaar_type: form.eigenaar_type || voorstel.eigenaar_type || '',
    eigenaar_bedrijfsnaam: form.eigenaar_bedrijfsnaam || voorstel.eigenaar_bedrijfsnaam || '',
    eigenaar_kvk: form.eigenaar_kvk || voorstel.eigenaar_kvk || '',
    eigenaar_straat_huisnummer: form.eigenaar_straat_huisnummer || voorstel.eigenaar_straat_huisnummer || '',
    eigenaar_postcode: form.eigenaar_postcode || voorstel.eigenaar_postcode || '',
    eigenaar_plaats: form.eigenaar_plaats || voorstel.eigenaar_plaats || '',
    eigenaar_verzendadres: form.eigenaar_verzendadres || voorstel.eigenaar_verzendadres || '',
    eigenaar_rechtstype: form.eigenaar_rechtstype || voorstel.eigenaar_rechtstype || '',
    eigenaar_aandeel: form.eigenaar_aandeel || voorstel.eigenaar_aandeel || '',
    eigenaar_rechtssituatie: form.eigenaar_rechtssituatie || voorstel.eigenaar_rechtssituatie || '',
    bloot_eigenaar: form.bloot_eigenaar || voorstel.bloot_eigenaar || null,
    kadastrale_aanduiding: form.kadastrale_aanduiding || voorstel.kadastrale_aanduiding || '',
    eigenaarbron: form.eigenaarbron || voorstel.eigenaarbron || '',
  };

  if (schoon(volgende.eigenaar_naam) || schoon(volgende.eigenaar_bedrijfsnaam)) {
    volgende.eigenaarstatus = 'gevonden';
  }
  return volgende;
}

export function patchVoorAutomatischeKadasterEigenaar(
  voorstel: KadasterEigenaarVoorstel,
): Record<string, unknown> | null {
  if (voorstel.status !== 'eenduidig') {
    return {
      eigenaar_controle_nodig: true,
      eigenaar_controle_reden: voorstel.controleReden ?? 'Kadasterrechten vereisen handmatige controle.',
    };
  }

  return {
    eigenaarstatus: 'gevonden',
    eigenaar_bekend: true,
    eigenaarbron: 'kadaster',
    status: voorstel.controleNodig ? 'eigenaar_achterhalen' : 'eigenaar_gevonden',
    eigenaar_naam: voorstel.eigenaar_naam ?? null,
    eigenaar_type: voorstel.eigenaar_type ?? null,
    eigenaar_bedrijfsnaam: voorstel.eigenaar_bedrijfsnaam ?? null,
    eigenaar_kvk: voorstel.eigenaar_kvk ?? null,
    eigenaar_straat_huisnummer: voorstel.eigenaar_straat_huisnummer ?? null,
    eigenaar_postcode: voorstel.eigenaar_postcode ?? null,
    eigenaar_plaats: voorstel.eigenaar_plaats ?? null,
    eigenaar_verzendadres: voorstel.eigenaar_verzendadres ?? null,
    eigenaar_rechtstype: voorstel.eigenaar_rechtstype ?? null,
    eigenaar_aandeel: voorstel.eigenaar_aandeel ?? null,
    eigenaar_rechtssituatie: voorstel.eigenaar_rechtssituatie ?? 'onbekend',
    bloot_eigenaar: voorstel.bloot_eigenaar ?? null,
    kadastrale_aanduiding: voorstel.kadastrale_aanduiding ?? null,
    eigenaar_controle_nodig: voorstel.controleNodig,
    eigenaar_controle_reden: voorstel.controleReden ?? null,
  };
}
