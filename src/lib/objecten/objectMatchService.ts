import type { ObjectVastgoed } from '@/data/mock-data';
import { normaliseerAdres, normaliseerTekst } from './adresNormalisatie';
import { maakKadastraleSleutel } from './objectIdentiteit';

export type ObjectMatchReden = 'crm_objectnummer' | 'intern_referentienummer' | 'kadastrale_identiteit' | 'volledig_adres';
export interface ObjectMatchResultaat { object: ObjectVastgoed; score: number; redenen: ObjectMatchReden[]; exact: boolean; }
export interface ObjectMatchInput { crmObjectnummer?: string; internReferentienummer?: string; adres?: string; postcode?: string; plaats?: string; kadastraleGemeente?: string; kadastraleSectie?: string; kadastraalNummer?: string; }

export function vindObjectMatches(input: ObjectMatchInput, objecten: ObjectVastgoed[]): ObjectMatchResultaat[] {
  const adres = normaliseerAdres(input);
  const kadaster = maakKadastraleSleutel(input);
  const crm = normaliseerTekst(input.crmObjectnummer);
  const intern = normaliseerTekst(input.internReferentienummer);
  return objecten.map(object => {
    const redenen: ObjectMatchReden[] = []; let score = 0;
    if (crm && normaliseerTekst(object.crmObjectnummer) === crm) { redenen.push('crm_objectnummer'); score += 100; }
    if (intern && normaliseerTekst(object.internReferentienummer) === intern) { redenen.push('intern_referentienummer'); score += 90; }
    if (kadaster && maakKadastraleSleutel(object) === kadaster) { redenen.push('kadastrale_identiteit'); score += 85; }
    if (adres.volledig && normaliseerAdres(object).sleutel === adres.sleutel) { redenen.push('volledig_adres'); score += 80; }
    return { object, score: Math.min(100, score), redenen, exact: redenen.length > 0 };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score || a.object.id.localeCompare(b.object.id));
}
