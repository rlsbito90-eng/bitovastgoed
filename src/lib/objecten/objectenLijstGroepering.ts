import type { ObjectVastgoed } from '@/data/mock-data';
import { objectMatchesCrmSearch } from './crmObjectnummer';

/**
 * De hoofdportefeuille vervangt in de Objecten-lijst alleen die onderliggende
 * rijen waarvan de parent óók zichtbaar is. Anders wordt een child nooit
 * stilzwijgend verborgen door een status- of typefilter.
 */
export function groepeerObjectenLijst<T extends Pick<ObjectVastgoed, 'id' | 'parentObjectId'>>(
  gefilterd: readonly T[],
  toonOnderdelenLos: boolean,
): T[] {
  if (toonOnderdelenLos) return [...gefilterd];
  const zichtbaar = new Set(gefilterd.map(o => o.id));
  return gefilterd.filter(o => !o.parentObjectId || !zichtbaar.has(o.parentObjectId));
}

export function indexeerPortefeuilleOnderdelen(objecten: readonly ObjectVastgoed[]): Map<string, ObjectVastgoed[]> {
  const byParent = new Map<string, ObjectVastgoed[]>();
  for (const o of objecten) {
    if (!o.parentObjectId || o.softDeletedAt) continue;
    const children = byParent.get(o.parentObjectId) ?? [];
    children.push(o);
    byParent.set(o.parentObjectId, children);
  }
  return byParent;
}

/** Een portefeuille kan worden gevonden via ieder van haar gekoppelde adressen. */
export function zoektInPortefeuilleOnderdelen(
  portefeuille: Pick<ObjectVastgoed, 'id' | 'isPortefeuille'>,
  children: readonly ObjectVastgoed[],
  zoek: string,
): boolean {
  if (!zoek.trim() || !portefeuille.isPortefeuille) return false;
  return children.some(o => !o.softDeletedAt && objectMatchesCrmSearch(o, zoek));
}
