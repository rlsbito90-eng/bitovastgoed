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
