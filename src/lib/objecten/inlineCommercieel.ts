import type { ObjectStatus, ObjectVastgoed } from '@/data/mock-data';
import { withExplicitObjectClearFields, type GuardedObjectPatch } from '@/lib/dataIntegrity/objectPayload';

export type FinancieelVeld = 'vraagprijs' | 'huurinkomsten';

export function maakInlineFinancieelPatch(
  veld:FinancieelVeld,waarde:number|undefined,
):GuardedObjectPatch {
  if(waarde===undefined)throw new Error('Voer een bedrag in of gebruik Waarde wissen.');
  if(!Number.isFinite(waarde)||waarde<0||waarde>1_000_000_000_000){
    throw new Error('Voer een geldig, niet-negatief bedrag in.');
  }
  if(Math.round(waarde*100)!==waarde*100 && Math.abs(waarde*100-Math.round(waarde*100))>1e-7){
    throw new Error('Gebruik maximaal twee decimalen.');
  }
  return {[veld]:waarde};
}

/** Bewust wissen: het financiële objectveld is beschermd door guardObjectPatch. */
export function maakInlineWisPatch(veld:FinancieelVeld):GuardedObjectPatch {
  return withExplicitObjectClearFields(
    {[veld]:null} as Partial<ObjectVastgoed>,
    [veld],
  );
}

export const DEFINITIEVE_OBJECTSTATUSSEN:ReadonlySet<ObjectStatus>=new Set([
  'verkocht','ingetrokken','afgevallen',
]);

export function moetStatusArchiveren(status:ObjectStatus):boolean {
  return DEFINITIEVE_OBJECTSTATUSSEN.has(status);
}
