export interface ObjectAdresInput {
  id?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  bagVerblijfsobjectId?: string | null;
}

export type ObjectMatchNiveau = 'bag_verblijfsobject' | 'exact_adres' | 'mogelijk_adres';

export interface ObjectMatch<T extends ObjectAdresInput = ObjectAdresInput> {
  object: T;
  niveau: ObjectMatchNiveau;
  score: number;
  reden: string;
}

function zonderDiakritiek(v: string): string {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normaliseerPostcode(v: string | null | undefined): string {
  return (v ?? '').toUpperCase().replace(/\s+/g, '').trim();
}

export function normaliseerPlaats(v: string | null | undefined): string {
  return zonderDiakritiek(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normaliseerAdres(v: string | null | undefined): string {
  return zonderDiakritiek(v ?? '')
    .toLowerCase()
    .replace(/\bstraat\b/g, 'str')
    .replace(/\blaan\b/g, 'ln')
    .replace(/\bplein\b/g, 'pln')
    .replace(/\bsingel\b/g, 'sngl')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function objectAdresSleutel(input: ObjectAdresInput): string | null {
  const postcode = normaliseerPostcode(input.postcode);
  const adres = normaliseerAdres(input.adres);
  const plaats = normaliseerPlaats(input.plaats);
  if (!adres) return null;
  if (postcode) return `adres:${postcode}|${adres}`;
  if (plaats) return `adres:${plaats}|${adres}`;
  return null;
}

export function zoekBestaandeObjecten<T extends ObjectAdresInput>(
  kandidaat: ObjectAdresInput,
  objecten: T[],
): ObjectMatch<T>[] {
  const bagId = (kandidaat.bagVerblijfsobjectId ?? '').trim();
  const kandidaatSleutel = objectAdresSleutel(kandidaat);
  const kandidaatAdres = normaliseerAdres(kandidaat.adres);
  const kandidaatPlaats = normaliseerPlaats(kandidaat.plaats);

  const matches: ObjectMatch<T>[] = [];
  for (const object of objecten) {
    if (kandidaat.id && object.id === kandidaat.id) continue;
    const objectBagId = (object.bagVerblijfsobjectId ?? '').trim();
    if (bagId && objectBagId && bagId === objectBagId) {
      matches.push({
        object,
        niveau: 'bag_verblijfsobject',
        score: 100,
        reden: 'Zelfde BAG-verblijfsobjectidentificatie.',
      });
      continue;
    }

    const objectSleutel = objectAdresSleutel(object);
    if (kandidaatSleutel && objectSleutel === kandidaatSleutel) {
      matches.push({
        object,
        niveau: 'exact_adres',
        score: 95,
        reden: 'Zelfde genormaliseerde postcode en adres.',
      });
      continue;
    }

    const objectAdres = normaliseerAdres(object.adres);
    const objectPlaats = normaliseerPlaats(object.plaats);
    if (
      kandidaatAdres
      && objectAdres === kandidaatAdres
      && kandidaatPlaats
      && objectPlaats === kandidaatPlaats
    ) {
      matches.push({
        object,
        niveau: 'mogelijk_adres',
        score: 80,
        reden: 'Zelfde genormaliseerde adres en plaats; postcode ontbreekt of wijkt af.',
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score || String(a.object.id).localeCompare(String(b.object.id)));
}

export function heeftBlokkerendeObjectmatch(matches: ObjectMatch[]): boolean {
  return matches.some((m) => m.niveau === 'bag_verblijfsobject' || m.niveau === 'exact_adres');
}
