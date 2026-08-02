import type { ObjectVastgoed } from '@/data/mock-data';
import { normaliseerAdres, normaliseerTekst } from './adresNormalisatie';

export type IntegriteitErnst = 'kritiek' | 'waarschuwing' | 'informatie';
export type IntegriteitCode =
  | 'adres_ontbreekt'
  | 'postcode_ontbreekt'
  | 'plaats_ontbreekt'
  | 'mogelijk_dubbel_adres'
  | 'dubbel_intern_referentienummer';

export interface ObjectIntegriteitIssue {
  code: IntegriteitCode;
  ernst: IntegriteitErnst;
  objectIds: string[];
  titel: string;
  toelichting: string;
}

export interface ObjectIntegriteitRapport {
  totaalObjecten: number;
  objectenMetIssues: number;
  issues: ObjectIntegriteitIssue[];
  aantallen: Record<IntegriteitCode, number>;
}

const legeAantallen = (): Record<IntegriteitCode, number> => ({
  adres_ontbreekt: 0,
  postcode_ontbreekt: 0,
  plaats_ontbreekt: 0,
  mogelijk_dubbel_adres: 0,
  dubbel_intern_referentienummer: 0,
});

function groepeer<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groepen = new Map<string, T[]>();
  for (const item of items) {
    const waarde = key(item);
    if (!waarde) continue;
    const groep = groepen.get(waarde) ?? [];
    groep.push(item);
    groepen.set(waarde, groep);
  }
  return groepen;
}

export function analyseerObjectIntegriteit(objecten: ObjectVastgoed[]): ObjectIntegriteitRapport {
  const issues: ObjectIntegriteitIssue[] = [];
  const objectIdsMetIssue = new Set<string>();
  const aantallen = legeAantallen();

  for (const object of objecten) {
    const velden: Array<[IntegriteitCode, string, string]> = [
      ['adres_ontbreekt', 'Adres ontbreekt', 'Vul een straatnaam en huisnummer in.'],
      ['postcode_ontbreekt', 'Postcode ontbreekt', 'Een postcode is nodig voor betrouwbare objectmatching.'],
      ['plaats_ontbreekt', 'Plaats ontbreekt', 'Vul de vestigingsplaats van het object in.'],
    ];
    const waarden = [object.adres, object.postcode, object.plaats];
    velden.forEach(([code, titel, toelichting], index) => {
      if (!waarden[index]?.trim()) {
        issues.push({ code, ernst: 'waarschuwing', objectIds: [object.id], titel, toelichting });
        aantallen[code] += 1;
        objectIdsMetIssue.add(object.id);
      }
    });
  }

  const adresGroepen = groepeer(objecten, object => {
    const adres = normaliseerAdres(object);
    return adres.volledig ? adres.sleutel : '';
  });
  for (const groep of adresGroepen.values()) {
    if (groep.length < 2) continue;
    const objectIds = groep.map(object => object.id);
    issues.push({
      code: 'mogelijk_dubbel_adres',
      ernst: 'kritiek',
      objectIds,
      titel: 'Mogelijk dubbel objectadres',
      toelichting: groep.map(object => object.crmObjectnummer ?? object.titel).join(', '),
    });
    aantallen.mogelijk_dubbel_adres += 1;
    objectIds.forEach(id => objectIdsMetIssue.add(id));
  }

  const referentieGroepen = groepeer(objecten, object => normaliseerTekst(object.internReferentienummer));
  for (const groep of referentieGroepen.values()) {
    if (groep.length < 2) continue;
    const objectIds = groep.map(object => object.id);
    issues.push({
      code: 'dubbel_intern_referentienummer',
      ernst: 'kritiek',
      objectIds,
      titel: 'Dubbel intern referentienummer',
      toelichting: groep.map(object => object.crmObjectnummer ?? object.titel).join(', '),
    });
    aantallen.dubbel_intern_referentienummer += 1;
    objectIds.forEach(id => objectIdsMetIssue.add(id));
  }

  return {
    totaalObjecten: objecten.length,
    objectenMetIssues: objectIdsMetIssue.size,
    issues,
    aantallen,
  };
}
