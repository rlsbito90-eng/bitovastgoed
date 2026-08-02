import type { ObjectVastgoed } from '@/data/mock-data';

export const CRM_OBJECTNUMMER_PATTERN = /^OBJ-[0-9]{6,}$/;

export function isCrmObjectnummer(value: unknown): value is string {
  return typeof value === 'string' && CRM_OBJECTNUMMER_PATTERN.test(value);
}

export function normalizeCrmObjectnummerQuery(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function objectMatchesCrmSearch(
  object: Pick<ObjectVastgoed, 'titel' | 'plaats' | 'crmObjectnummer'>,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const normalizedObjectNumber = normalizeCrmObjectnummerQuery(object.crmObjectnummer ?? '').toLowerCase();
  const normalizedNumberQuery = normalizeCrmObjectnummerQuery(query).toLowerCase();

  return object.titel.toLowerCase().includes(normalizedQuery)
    || object.plaats.toLowerCase().includes(normalizedQuery)
    || normalizedObjectNumber.includes(normalizedNumberQuery);
}
