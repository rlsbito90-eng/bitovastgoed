import type { Partijprofiel, VastgoedStrategie, PartijType } from '@/data/mock-data';

export const PARTIJPROFIELEN: readonly { value: Partijprofiel; label: string }[] = [
  {value:'belegger',label:'Belegger'},
  {value:'ontwikkelende_belegger',label:'Ontwikkelende belegger'},
  {value:'ontwikkelaar',label:'Ontwikkelaar'},
  {value:'vastgoedondernemer',label:'Vastgoedondernemer'},
  {value:'makelaar',label:'Makelaar'},
  {value:'bemiddelaar',label:'Bemiddelaar'},
  {value:'vastgoedeigenaar',label:'Vastgoedeigenaar'},
  {value:'overig',label:'Overig'},
] as const;
export const VASTGOEDSTRATEGIEEN: readonly { value: VastgoedStrategie; label: string }[] = [
  {value:'langetermijnbelegging',label:'Langetermijnbelegging'},
  {value:'value_add',label:'Value-add'},
  {value:'transformatie',label:'Transformatie'},
  {value:'uitponden',label:'Uitponden'},
  {value:'projectontwikkeling',label:'Projectontwikkeling'},
  {value:'handel',label:'Handel'},
] as const;

const allowedProfile = new Set<string>(PARTIJPROFIELEN.map(x=>x.value));
const allowedStrategies = new Set<string>(VASTGOEDSTRATEGIEEN.map(x=>x.value));

/** Unknown profile is NULL. Legacy type_partij is deliberately not inferred or overwritten. */
export function leesPartijprofiel(v:unknown):Partijprofiel|null {
  if (v == null) return null;
  if (typeof v !== 'string' || !allowedProfile.has(v)) throw new Error('Ongeldig partijprofiel');
  return v as Partijprofiel;
}
export function leesVastgoedStrategieen(v:unknown):VastgoedStrategie[]|null {
  if (v == null) return null;
  if (!Array.isArray(v)) throw new Error('Ongeldige vastgoedstrategieën');
  const result:VastgoedStrategie[]=[];
  for (const item of v){
    if(typeof item!=='string'||!allowedStrategies.has(item))throw new Error('Onbekende vastgoedstrategie');
    if(!result.includes(item as VastgoedStrategie)) result.push(item as VastgoedStrategie);
  }
  return result;
}
export function schrijfPartijprofiel(v:Partijprofiel|null|undefined):Partijprofiel|null|undefined{
  return v===undefined ? undefined : leesPartijprofiel(v);
}
export function schrijfVastgoedStrategieen(v:readonly VastgoedStrategie[]|null|undefined):VastgoedStrategie[]|null|undefined{
  return v===undefined ? undefined : leesVastgoedStrategieen(v);
}
export function labelPartijprofiel(value:Partijprofiel){return PARTIJPROFIELEN.find(x=>x.value===value)?.label??value}
export function labelVastgoedStrategie(value:VastgoedStrategie){return VASTGOEDSTRATEGIEEN.find(x=>x.value===value)?.label??value}

/**
 * Compatibility only: type_partij is a required legacy column used by existing
 * CRM features. New relations receive a broad value derived from their explicit
 * party profile; existing relations are never reclassified here.
 *
 * No buyer/mandate/commercial role may be inferred from this mapping.
 */
export function legacyTypeVoorNieuweRelatie(profiel: Partijprofiel): PartijType {
  switch (profiel) {
    case 'belegger':
    case 'ontwikkelende_belegger':
      return 'belegger';
    case 'ontwikkelaar':
      return 'ontwikkelaar';
    case 'makelaar':
    case 'bemiddelaar':
      return 'makelaar';
    case 'vastgoedeigenaar':
      return 'eigenaar';
    case 'vastgoedondernemer':
    case 'overig':
      return 'overig';
  }
}
