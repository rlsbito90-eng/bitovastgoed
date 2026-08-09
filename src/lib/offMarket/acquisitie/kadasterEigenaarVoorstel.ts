import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import type {
  OffMarketEigenaarbron,
  OffMarketEigenaarstatus,
  OffMarketEigenaartype,
} from '@/lib/offMarket/types';

export interface KadasterEigenaarVoorstel {
  status: 'geen' | 'eenduidig' | 'ambigu';
  eigenaarstatus?: OffMarketEigenaarstatus;
  eigenaar_type?: OffMarketEigenaartype;
  eigenaar_naam?: string;
  eigenaar_bedrijfsnaam?: string;
  eigenaar_kvk?: string;
  kadastrale_aanduiding?: string;
  eigenaarbron?: OffMarketEigenaarbron;
}

export interface EigenaarVoorstelForm {
  eigenaarstatus: OffMarketEigenaarstatus;
  eigenaar_naam: string;
  eigenaar_type: OffMarketEigenaartype | '';
  eigenaar_bedrijfsnaam: string;
  eigenaar_kvk: string;
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

/**
 * Bouw uitsluitend een voorstel uit reeds genormaliseerde Kadasterrechten.
 * Meerdere verschillende rechthebbenden zijn bewust ambigu: er wordt dan
 * geen eigenaar gekozen of ingevuld.
 */
export function maakKadasterEigenaarVoorstel(
  blokken: readonly KadasterRechtenBlok[],
): KadasterEigenaarVoorstel {
  const kandidaten = blokken
    .map((blok) => {
      const naam = schoon(blok.naam);
      const bedrijfsnaam = schoon(blok.bedrijfsnaam);
      const label = blok.persoonType === 'natuurlijk' ? naam : (bedrijfsnaam || naam);
      if (!label) return null;
      return { blok, label, sleutel: normaliseerNaam(label) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (kandidaten.length === 0) return { status: 'geen' };

  const uniek = new Map<string, typeof kandidaten[number]>();
  for (const kandidaat of kandidaten) {
    if (!uniek.has(kandidaat.sleutel)) uniek.set(kandidaat.sleutel, kandidaat);
  }
  if (uniek.size !== 1) return { status: 'ambigu' };

  const { blok, label } = [...uniek.values()][0];
  const basis = {
    status: 'eenduidig' as const,
    eigenaarstatus: 'gevonden' as const,
    eigenaarbron: 'kadaster' as const,
    eigenaar_kvk: schoon(blok.kvkNummer) || undefined,
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
    kadastrale_aanduiding: form.kadastrale_aanduiding || voorstel.kadastrale_aanduiding || '',
    eigenaarbron: form.eigenaarbron || voorstel.eigenaarbron || '',
  };

  if (schoon(volgende.eigenaar_naam) || schoon(volgende.eigenaar_bedrijfsnaam)) {
    volgende.eigenaarstatus = 'gevonden';
  }
  return volgende;
}
