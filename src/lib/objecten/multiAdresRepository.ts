import type { ObjectAdresRecord } from './adresModel';

export interface AdresRpcClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

export interface MultiAdresSnapshot {
  etag: string;
  adressen: ObjectAdresRecord[];
}

export type AdresConcept = Pick<
  ObjectAdresRecord, 'id' | 'adres' | 'postcode' | 'plaats' | 'provincie' | 'isHoofdadres'
>;

export class AdresOpslagFout extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'AdresOpslagFout';
  }
}

type Row = {
  id: string;
  object_id: string;
  adresregel: string;
  postcode: string | null;
  plaats: string;
  provincie: string | null;
  land?: string | null;
  is_hoofdadres: boolean;
  bag_nummeraanduiding_id?: string | null;
  bag_verblijfsobject_id?: string | null;
  bron?: string | null;
  verificatie_status?: ObjectAdresRecord['verificatieStatus'];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ETAG = /^[0-9a-f]{32}$/i;
const clean = (v?: string | null) => (v ?? '').trim();
const compact = (v: string) => v.toLocaleLowerCase('nl-NL').replace(/\s+/g, ' ');
const postcode = (v?: string | null) => clean(v).replace(/\s+/g, '').toLocaleLowerCase('nl-NL');

function parseSnapshot(value: unknown, objectId: string): MultiAdresSnapshot {
  if (!value || typeof value !== 'object') throw new AdresOpslagFout('Onbekend antwoord van adresregister.');
  const raw = value as { etag?: unknown; adressen?: unknown };
  if (typeof raw.etag !== 'string' || !ETAG.test(raw.etag) || !Array.isArray(raw.adressen)) {
    throw new AdresOpslagFout('Ongeldige adresversie ontvangen.');
  }
  const adressen = raw.adressen.map((record: unknown) => {
    if (!record || typeof record !== 'object') throw new AdresOpslagFout('Onjuist adresrecord ontvangen.');
    const row = record as Row;
    if (row.object_id !== objectId || typeof row.id !== 'string' || !UUID.test(row.id)
      || typeof row.adresregel !== 'string' || typeof row.plaats !== 'string'
      || typeof row.is_hoofdadres !== 'boolean') {
      throw new AdresOpslagFout('Adresrecord voldoet niet aan de verwachte gegevensstructuur.');
    }
    return {
      id: row.id, objectId, adres: row.adresregel, postcode: row.postcode,
      plaats: row.plaats, provincie: row.provincie,
      land: row.land, isHoofdadres: row.is_hoofdadres,
      bagNummeraanduidingId: row.bag_nummeraanduiding_id,
      bagVerblijfsobjectId: row.bag_verblijfsobject_id,
      bron: row.bron,
      verificatieStatus: row.verificatie_status,
    } satisfies ObjectAdresRecord;
  });
  return { etag: raw.etag, adressen };
}

export function valideerAdresConcept(adressen: readonly AdresConcept[]): string | null {
  if (adressen.length < 1 || adressen.length > 100) return 'Vul minimaal één en maximaal honderd adressen in.';
  if (adressen.filter(a => a.isHoofdadres).length !== 1) return 'Selecteer precies één hoofdadres.';
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const a of adressen) {
    if (!clean(a.adres) || !clean(a.plaats)) return 'Straat/huisnummer en plaats zijn verplicht.';
    if (!a.id || (!UUID.test(a.id) && !a.id.startsWith('draft:') && !a.id.startsWith('legacy:'))) {
      return 'Onbekende adresidentificatie. Vernieuw het dossier.';
    }
    if (ids.has(a.id)) return 'Dubbele adresidentificatie. Vernieuw het dossier.';
    ids.add(a.id);
    const key = [compact(clean(a.adres)), postcode(a.postcode), compact(clean(a.plaats))].join('|');
    if (seen.has(key)) return 'Hetzelfde adres is meerdere keren ingevoerd.';
    seen.add(key);
  }
  return null;
}

export function naarAdresPayload(adressen: readonly AdresConcept[]): Record<string, unknown>[] {
  const fout = valideerAdresConcept(adressen);
  if (fout) throw new AdresOpslagFout(fout);
  return adressen.map(a => ({
    ...(UUID.test(a.id) ? { id: a.id } : {}),
    adresregel: clean(a.adres),
    postcode: clean(a.postcode) || null,
    plaats: clean(a.plaats),
    provincie: clean(a.provincie) || null,
    is_hoofdadres: a.isHoofdadres,
  }));
}

function assertResult(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === '40001') {
    throw new AdresOpslagFout('De adressen zijn elders gewijzigd. Vernieuw het dossier voordat je opnieuw opslaat.', error.code);
  }
  if (error.code === '23503') {
    throw new AdresOpslagFout('Een adres is nog gekoppeld aan een objectonderdeel of hoort bij een ander object.', error.code);
  }
  if (error.code === '42501') {
    throw new AdresOpslagFout('Je hebt geen toegang tot dit adresregister.', error.code);
  }
  throw new AdresOpslagFout(error.message ?? 'Adressen konden niet worden opgeslagen.', error.code);
}

/** Deze functies lezen/schrijven pas bij een expliciete aanroep door een geautoriseerde UI. */
export async function laadObjectAdressen(client: AdresRpcClient, objectId: string): Promise<MultiAdresSnapshot> {
  if (!UUID.test(objectId)) throw new AdresOpslagFout('Ongeldig object-ID.');
  const { data, error } = await client.rpc('crm_object_adressen_snapshot', { p_object_id: objectId });
  assertResult(error);
  return parseSnapshot(data, objectId);
}

export async function bewaarObjectAdressen(
  client: AdresRpcClient,
  objectId: string,
  expectedEtag: string,
  adressen: readonly AdresConcept[],
): Promise<MultiAdresSnapshot> {
  if (!UUID.test(objectId) || !ETAG.test(expectedEtag)) throw new AdresOpslagFout('Vernieuw het dossier voordat je opslaat.');
  const payload = naarAdresPayload(adressen);
  const { data, error } = await client.rpc('crm_object_adressen_opslaan', {
    p_object_id: objectId, p_expected_etag: expectedEtag, p_adressen: payload,
  });
  assertResult(error);
  return parseSnapshot(data, objectId);
}
