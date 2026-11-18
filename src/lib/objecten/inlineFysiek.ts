import type { ObjectVastgoed, AssetClass } from '@/data/mock-data';
import { PROPERTY_TYPE_SLUG_NAAR_ASSET_CLASS } from '@/lib/taxonomie-mapping';
import { withExplicitObjectClearFields, type GuardedObjectPatch } from '@/lib/dataIntegrity/objectPayload';

export type OppervlakteVeld =
  | 'oppervlakte'|'oppervlakteVvo'|'oppervlakteBvo'
  | 'oppervlakteGbo'|'perceelOppervlakte';

export const OPPERVLAKTE_VELDEN:ReadonlyArray<{
  veld:OppervlakteVeld;label:string;hulp:string;
}> = [
  {veld:'oppervlakte',label:'Totaal (m²)',hulp:'Algemene totaaloppervlakte; de meetsoort is niet altijd bekend'},
  {veld:'oppervlakteVvo',label:'VVO (m²)',hulp:'Verhuurbaar vloeroppervlak'},
  {veld:'oppervlakteBvo',label:'BVO (m²)',hulp:'Bruto vloeroppervlak'},
  {veld:'oppervlakteGbo',label:'GBO (m²)',hulp:'Gebruiksoppervlak'},
  {veld:'perceelOppervlakte',label:'Perceel (m²)',hulp:'Grondoppervlakte, geen vloeroppervlak'},
];

export function maakOppervlaktePatch(veld:OppervlakteVeld,waarde:number|undefined):GuardedObjectPatch {
  if(waarde===undefined||!Number.isFinite(waarde)||waarde<=0||waarde>100_000_000)
    throw new Error('Voer een geldig oppervlak groter dan nul in, of kies Waarde wissen.');
  if(Math.abs(waarde*100-Math.round(waarde*100))>1e-7)
    throw new Error('Gebruik maximaal twee decimalen.');
  return {[veld]:waarde};
}
export function maakOppervlakteWisPatch(veld:OppervlakteVeld):GuardedObjectPatch {
  return withExplicitObjectClearFields(
    {[veld]:null} as unknown as Partial<ObjectVastgoed>,[veld]);
}
export function maakObjectTypePatch(
  nieuw:{id:string;slug:string},
):GuardedObjectPatch {
  const asset:AssetClass|undefined=PROPERTY_TYPE_SLUG_NAAR_ASSET_CLASS[nieuw.slug];
  if(!nieuw.id||!asset)throw new Error('Onbekend vastgoedtype. Het huidige type is behouden.');
  return {
    propertyTypeId:nieuw.id,
    type:asset,
    propertySubtypeIds:[],
    subcategorieId:null as unknown as string,
  };
}

export const EIGENDOM_KEUZES = [
  'Vol eigendom','Appartementsrecht','Erfpacht',
  'Opstalrecht','Recht van gebruik','Overige',
] as const;

/** Onbekende/legacy omschrijvingen blijven exact behouden tot handmatige wijziging. */
export function eigendomIsStandaard(waarde:string|undefined|null):boolean {
  return !!waarde&&EIGENDOM_KEUZES.some(v=>v===waarde);
}
