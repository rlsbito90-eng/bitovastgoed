import type { ObjectVastgoed } from '@/data/mock-data';
import type { GuardedObjectPatch } from '@/lib/dataIntegrity/objectPayload';

export type LocatieInvoer = {
  adres:string;postcode:string;plaats:string;provincie:string;publiekeRegio:string;
};

export function locatieInvoerVanObject(o:ObjectVastgoed):LocatieInvoer {
  return {
    adres:o.adres??'',
    postcode:o.postcode??'',
    plaats:o.plaats??'',
    provincie:o.provincie??'',
    publiekeRegio:o.publiekeRegio??'',
  };
}

export function normaliseerPostcodeWeergave(input:string):string {
  const compact=input.trim().replace(/\s+/g,'').toUpperCase();
  return /^[1-9][0-9]{3}[A-Z]{2}$/.test(compact)
    ? `${compact.slice(0,4)} ${compact.slice(4)}`
    : input.trim();
}

/**
 * Wijzig alle betrokken adresvelden atomair en ververs BAG/geo-verificatie
 * alleen wanneer de daadwerkelijke locatie veranderd is. Een wijziging van
 * uitsluitend de publieke (anonieme) regio mag géén geo-coördinaten wissen.
 * Alle geo-velden worden expliciet op NULL gezet; een oude BAG-match
 * mag niet bij een nieuw objectadres blijven staan.
 */
export function maakLocatiePatch(huidig:ObjectVastgoed,form:LocatieInvoer):GuardedObjectPatch {
  const next={
    adres:form.adres.trim(),
    postcode:normaliseerPostcodeWeergave(form.postcode),
    plaats:form.plaats.trim(),
    provincie:form.provincie.trim(),
    publiekeRegio:form.publiekeRegio.trim(),
  };
  const prev=locatieInvoerVanObject(huidig);
  const patch:GuardedObjectPatch={};
  const keys=Object.keys(next) as Array<keyof LocatieInvoer>;

  for(const key of keys){
    const oude=key==='postcode'?normaliseerPostcodeWeergave(prev[key]):prev[key].trim();
    if(next[key]===oude)continue;
    // Gebruik null in plaats van undefined: undefined is bij updates 'ongewijzigd'.
    // Formele weergave blijft op db/objectFromDb consistent.
    (patch as Record<string,unknown>)[key]=next[key]||null;
  }
  const gewijzigdeLocatie=['adres','postcode','plaats','provincie']
    .some(key=>key in patch);
  if(gewijzigdeLocatie){
    const postcodeVeranderd='postcode' in patch;
    if(postcodeVeranderd && next.postcode && !/^[1-9][0-9]{3} [A-Z]{2}$/.test(next.postcode)){
      throw new Error('Gebruik een Nederlandse postcode van vier cijfers en twee letters (bijvoorbeeld 1234 AB).');
    }
    if(huidig.geoLat!=null||huidig.geoLon!=null||huidig.geoBron||huidig.geoGeverifieerdOp){
      patch.geoLat=null as unknown as number;
      patch.geoLon=null as unknown as number;
      patch.geoBron=null as unknown as string;
      patch.geoGeverifieerdOp=null as unknown as string;
    }
  }
  return patch;
}
