import type { ObjectVastgoed } from '@/data/mock-data';
import { normaliseerAdres, normaliseerTekst } from './adresNormalisatie';

export interface ObjectIdentiteit {
  objectId: string;
  crmObjectnummer?: string;
  internReferentienummer?: string;
  adresSleutel?: string;
  kadastraleSleutel?: string;
}

export function maakKadastraleSleutel(object: Pick<ObjectVastgoed, 'kadastraleGemeente' | 'kadastraleSectie' | 'kadastraalNummer'>): string | undefined {
  const delen = [object.kadastraleGemeente, object.kadastraleSectie, object.kadastraalNummer].map(normaliseerTekst);
  return delen.every(Boolean) ? delen.join('|') : undefined;
}

export function projecteerObjectIdentiteit(object: ObjectVastgoed): ObjectIdentiteit {
  const adres = normaliseerAdres(object);
  return {
    objectId: object.id,
    crmObjectnummer: object.crmObjectnummer,
    internReferentienummer: object.internReferentienummer,
    adresSleutel: adres.volledig ? adres.sleutel : undefined,
    kadastraleSleutel: maakKadastraleSleutel(object),
  };
}
