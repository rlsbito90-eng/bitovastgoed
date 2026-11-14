import type { ObjectVastgoed } from '@/data/mock-data';

export const CRM_OBJECTNUMMER_PATTERN = /^OBJ-[0-9]{6,}$/;

export function isCrmObjectnummer(value: unknown): value is string {
  return typeof value === 'string' && CRM_OBJECTNUMMER_PATTERN.test(value);
}

export function normalizeCrmObjectnummerQuery(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function objectMatchesCrmSearch(
  object: Pick<ObjectVastgoed, 'titel' | 'plaats' | 'crmObjectnummer' | 'adres' | 'postcode' | 'publiekeRegio'>,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const normalizedObjectNumber = normalizeCrmObjectnummerQuery(object.crmObjectnummer ?? '').toLowerCase();
  const normalizedNumberQuery = normalizeCrmObjectnummerQuery(query).toLowerCase();

  const fields = [object.titel, object.adres, object.postcode, object.plaats, object.publiekeRegio]
    .filter((field): field is string => typeof field === 'string' && field.length > 0);
  // Postcodes zijn met én zonder spatie doorzoekbaar.
  const compact = (value: string) => value.toLocaleLowerCase('nl-NL').replace(/[\\s-]/g, '');
  return fields.some(field =>
    field.toLocaleLowerCase('nl-NL').includes(normalizedQuery)
    || compact(field).includes(compact(normalizedQuery)))
    || normalizedObjectNumber.includes(normalizedNumberQuery);
}
