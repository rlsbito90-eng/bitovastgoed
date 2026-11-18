import type { Taak } from '@/data/mock-data';
import { sorteerTaken } from '@/lib/taakHelpers';

/** Eén lijst van rechtstreekse en via deal gekoppelde taken.
 * Afgeronde, geannuleerde en verwijderde taken horen niet bij open opvolging.
 */
export function verzamelOpenDossierTaken(bronnen:readonly (readonly Taak[])[],now:Date=new Date()):Taak[]{
  const unieke=new Map<string,Taak>();
  for(const bron of bronnen){
    for(const taak of bron){
      if(taak.softDeletedAt||taak.status==='afgerond'||taak.status==='geannuleerd')continue;
      unieke.set(taak.id,taak);
    }
  }
  return sorteerTaken([...unieke.values()],now);
}
