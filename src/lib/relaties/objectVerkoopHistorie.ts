import type { ObjectVastgoed } from '@/data/mock-data';

/**
 * Gekoppelde objecten bij een verkooprelatie, zonder een vrije tekstnaam
 * als een bewezen relatie-ID te behandelen.
 *
 * Deze lijst toont registratiehistorie, geen bewezen datum van aanlevering.
 * Gearchiveerde / verkochte objecten blijven zichtbaar voor de historie.
 */
export function gekoppeldeVerkoopobjecten(
  relatieId: string,
  objecten: readonly ObjectVastgoed[],
): ObjectVastgoed[] {
  if (!relatieId) return [];
  return objecten
    .filter(o => o.eigenaarRelatieId === relatieId && !o.softDeletedAt)
    .sort((a,b) => {
      const da = a.datumToegevoegd ?? '';
      const db = b.datumToegevoegd ?? '';
      const cmp = db.localeCompare(da);
      return cmp !== 0 ? cmp : a.titel.localeCompare(b.titel,'nl-NL');
    });
}
