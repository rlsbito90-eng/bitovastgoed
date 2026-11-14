/**
 * Canonieke adresweergave voor Bito CRM — nog zonder database-migratie.
 *
 * Een object kan later meerdere adressen hebben zonder extra Objecten-records.
 * Bestaande objecten blijven leesbaar via het legacy adresveld.
 * Geen automatische koppelingen op basis van alleen postcode of BAG-nummer.
 */
export interface ObjectAdresRecord {
  id: string;
  objectId: string;
  adres: string;
  postcode?: string | null;
  plaats?: string | null;
  provincie?: string | null;
  land?: string | null;
  isHoofdadres: boolean;
  bagNummeraanduidingId?: string | null;
  bagVerblijfsobjectId?: string | null;
  bron?: string | null;
  verificatieStatus?: 'onbekend' | 'te_controleren' | 'geverifieerd';
}
export interface LegacyAdresObject {
  id: string;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
  provincie?: string | null;
}
export interface ObjectAdresOverzicht {
  adressen: ObjectAdresRecord[];
  hoofdadres: ObjectAdresRecord | null;
  bron: 'gekoppeld' | 'legacy' | 'geen';
  controlepunten: string[];
}
const compact = (v?: string | null): string => (v ?? '').trim().toLocaleLowerCase('nl-NL')
  .replace(/\\s+/g, ' ')
  .replace(/[.,]+$/g, '');

/**
 * Read-only samengestelde weergave.
 * Nieuwe adressen winnen wanneer aanwezig, anders het opgeslagen legacy adres.
 * Legacy + nieuwe adressen worden NIET automatisch opgeteld: dat zou
 * hetzelfde adres dubbel kunnen presenteren.
 */
export function resolveObjectAdressen(
  object: LegacyAdresObject,
  gekoppeld: readonly ObjectAdresRecord[] = [],
): ObjectAdresOverzicht {
  const controlepunten: string[] = [];
  const relaties = gekoppeld.filter(a => {
    if (a.objectId === object.id) return true;
    controlepunten.push('Adres hoort bij een ander object; niet getoond.');
    return false;
  });
  if (relaties.length) {
    const uniekeIds = new Set<string>();
    const adressen: ObjectAdresRecord[] = [];
    for (const a of relaties) {
      if (!a.id || uniekeIds.has(a.id)) {
        controlepunten.push('Dubbele of ontbrekende adres-ID; controle nodig.');
        continue;
      }
      uniekeIds.add(a.id);
      adressen.push(a);
      if (!a.adres?.trim() || !a.plaats?.trim()) {
        controlepunten.push('Adres of plaats ontbreekt bij gekoppeld adres.');
      }
    }
    const hoofdadressen = adressen.filter(a => a.isHoofdadres);
    if (hoofdadressen.length !== 1) {
      controlepunten.push('Er moet precies één hoofdadres worden bevestigd.');
    }
    const keys = new Set<string>();
    for (const a of adressen) {
      if (!a.adres?.trim()) continue;
      const key = [compact(a.adres), compact(a.postcode), compact(a.plaats)].join('|');
      if (keys.has(key)) controlepunten.push('Mogelijk dubbel geregistreerd adres.');
      keys.add(key);
    }
    return {
      adressen, hoofdadres: hoofdadressen.length === 1 ? hoofdadressen[0] : null,
      bron: 'gekoppeld', controlepunten: [...new Set(controlepunten)],
    };
  }
  const straat = object.adres?.trim();
  if (!straat) {
    return { adressen: [], hoofdadres: null, bron: 'geen', controlepunten: [...new Set(controlepunten)] };
  }
  const huidig: ObjectAdresRecord = {
    id: `legacy:${object.id}`, objectId: object.id, adres: straat,
    postcode: object.postcode ?? null, plaats: object.plaats ?? null,
    provincie: object.provincie ?? null, land: 'Nederland',
    isHoofdadres: true, verificatieStatus: 'onbekend',
    bron: 'bestaand objectveld',
  };
  if (!object.plaats?.trim()) controlepunten.push('Plaats bij bestaand adres ontbreekt.');
  return { adressen: [huidig], hoofdadres: huidig, bron: 'legacy', controlepunten: [...new Set(controlepunten)] };
}

/** Niet ontsluiten zonder compleet adres: Google Maps zoekt anders een willekeurige plaats. */
export function kanAdresOpKaart(record: Pick<ObjectAdresRecord,'adres'|'plaats'>): boolean {
  return Boolean(record.adres?.trim() && record.plaats?.trim());
}
