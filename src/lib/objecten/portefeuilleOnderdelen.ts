import type { ObjectVastgoed } from '@/data/mock-data';

/** Direct gekoppelde portefeuilleonderdelen; geen automatische prijs- of huursom. */
export function portefeuilleOnderdelen(
  objecten: readonly ObjectVastgoed[],
  parentId: string,
): ObjectVastgoed[] {
  return objecten
    .filter(o => o.id !== parentId && o.parentObjectId === parentId && !o.softDeletedAt)
    .sort((a, b) => a.titel.localeCompare(b.titel, 'nl'));
}

/** Alleen zelfstandige, actieve, nog niet gekoppelde objecten zijn koppelbaar. */
export function beschikbarePortefeuilleOnderdelen(
  objecten: readonly ObjectVastgoed[],
  parentId: string,
): ObjectVastgoed[] {
  return objecten
    .filter(o => o.id !== parentId && !o.parentObjectId
      && !o.isPortefeuille && !o.isArchived && !o.softDeletedAt)
    .sort((a, b) => a.titel.localeCompare(b.titel, 'nl'));
}

/** Adreslabel zonder te gokken op huisnummers of ontbrekende gegevens. */
export function portefeuilleAdresLabel(
  o: Pick<ObjectVastgoed, 'adres' | 'postcode' | 'plaats' | 'publiekeRegio'>,
): string {
  return [o.adres, [o.postcode, o.plaats].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || o.publiekeRegio || 'Adres nog niet ingevuld';
}

/** Read-only inventarisatie van reeds ingevulde child-records.
 * Dit bewijst NIET dat alle panden van een verkooppropositie gekoppeld zijn.
 * De hoofddossierhuur en prijs worden nooit geaggregeerd of overschreven.
 */
export interface PortefeuilleInventarisatie {
  aantal: number;
  metVolledigAdres: number;
  metJaarhuur: number;
  metEigenPrijs: number;
  oppervlakte: {
    meetbasis: 'vvo' | 'gbo' | 'bvo' | null;
    m2: number | null;
    van: number;
    toelichting: string;
  };
}

const meetbareM2 = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function inventariseerPortefeuilleOnderdelen(
  onderdelen: readonly Pick<ObjectVastgoed,
    'adres' | 'plaats' | 'huurinkomsten' | 'vraagprijs' |
    'oppervlakteVvo' | 'oppervlakteGbo' | 'oppervlakteBvo'>[],
): PortefeuilleInventarisatie {
  const aantal = onderdelen.length;
  const metVolledigAdres = onderdelen.filter(o => Boolean(o.adres?.trim() && o.plaats?.trim())).length;
  const metJaarhuur = onderdelen.filter(o =>
    typeof o.huurinkomsten === 'number' && Number.isFinite(o.huurinkomsten) && o.huurinkomsten >= 0,
  ).length;
  const metEigenPrijs = onderdelen.filter(o =>
    typeof o.vraagprijs === 'number' && Number.isFinite(o.vraagprijs) && o.vraagprijs >= 0,
  ).length;
  const bases = [
    { meetbasis: 'vvo' as const, key: 'oppervlakteVvo' as const },
    { meetbasis: 'gbo' as const, key: 'oppervlakteGbo' as const },
    { meetbasis: 'bvo' as const, key: 'oppervlakteBvo' as const },
  ];
  // Kies alleen een uniforme basis voor álle gekoppelde records.
  const uniform = bases.find(({ key }) => aantal > 0 &&
    onderdelen.every(o => meetbareM2(o[key])));
  const besteDekking = bases.map(({ key, meetbasis })=>({
    meetbasis, count: onderdelen.filter(o => meetbareM2(o[key])).length,
  })).sort((a,b)=>b.count-a.count)[0];
  const van = uniform ? aantal : besteDekking?.count ?? 0;
  const m2 = uniform
    ? onderdelen.reduce((total,o)=>total+(o[uniform.key] ?? 0),0)
    : null;
  return {
    aantal, metVolledigAdres, metJaarhuur, metEigenPrijs,
    oppervlakte: uniform
      ? { meetbasis: uniform.meetbasis, m2, van,
        toelichting: 'Som gekoppelde onderdelen; geen geverifieerd pakketoppervlak.' }
      : { meetbasis: null, m2: null, van,
        toelichting: aantal===0
          ? 'Nog geen onderdelen gekoppeld.'
          : 'Oppervlakte niet volledig en op één meetbasis beschikbaar; geen totaalsom.' },
  };
}

/** Benoem een beschikbare individuele meetbasis, zonder generieke m² als GBO/VVO te labelen. */
export function individueleOppervlakte(
  onderdeel: Pick<ObjectVastgoed,'oppervlakteVvo'|'oppervlakteGbo'|'oppervlakteBvo'>,
): { m2: number; meetbasis: 'vvo'|'gbo'|'bvo' } | null {
  if (meetbareM2(onderdeel.oppervlakteVvo)) return {m2:onderdeel.oppervlakteVvo, meetbasis:'vvo'};
  if (meetbareM2(onderdeel.oppervlakteGbo)) return {m2:onderdeel.oppervlakteGbo, meetbasis:'gbo'};
  if (meetbareM2(onderdeel.oppervlakteBvo)) return {m2:onderdeel.oppervlakteBvo, meetbasis:'bvo'};
  return null;
}
