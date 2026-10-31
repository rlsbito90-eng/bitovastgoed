import type { CommercieleRol } from '@/data/mock-data';

export const COMMERCIELE_ROLLEN: readonly { value: CommercieleRol; label: string }[] = [
 {value:'koper',label:'Koper'},
 {value:'verkoper',label:'Verkoper'},
 {value:'makelaar',label:'Makelaar'},
 {value:'bemiddelaar',label:'Bemiddelaar'},
 {value:'ontwikkelaar',label:'Ontwikkelaar'},
 {value:'adviseur',label:'Adviseur'},
 {value:'beheerder',label:'Beheerder'},
 {value:'financier',label:'Financier'},
 {value:'overig',label:'Overig'},
] as const;
const toegestaan=new Set<string>(COMMERCIELE_ROLLEN.map(r=>r.value));
/** No automatic inference from type_partij. Null means not yet established. */
export function leesCommercieleRollen(bron: unknown): CommercieleRol[] | null {
 if(bron==null) return null;
 if(!Array.isArray(bron)) throw new Error('Ongeldige commerciële rollen in database');
 const rollen:string[]=bron.map(x=>{
   if(typeof x!=='string'||!toegestaan.has(x)) throw new Error('Onbekende commerciële rol');
   return x;
 });
 return [...new Set(rollen)] as CommercieleRol[];
}
/** Undefined = leave DB field unchanged; null = unknown, [] = intentionally empty. */
export function schrijfCommercieleRollen(rollen: readonly CommercieleRol[] | null | undefined):
 CommercieleRol[] | null | undefined {
 if(rollen === undefined) return undefined;
 return leesCommercieleRollen(rollen);
}
export function labelCommercieleRol(rol:CommercieleRol):string {
 return COMMERCIELE_ROLLEN.find(x=>x.value===rol)?.label??rol;
}
